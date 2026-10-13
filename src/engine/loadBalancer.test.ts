import { describe, expect, it } from 'vitest';
import { getNumber } from '../data/numbers';
import { createState, step } from './step';
import type { Action, LoadBalancerNode, SimState, WorkNode, World } from './types';

// M2 step 2: load balancer + kill a server (docs/milestones/m2-load-balancer-kill.md, ADR 0011).

const DT = 0.05;
const n = (id: string) => getNumber('teaching', id);
const capacity = n('server.small.capacity').value;
const perUser = n('traffic.requestsPerUserPerSec').value;
const healthCheckWindow = n('lb.healthCheckSeconds').value;
const lbLatency = n('lb.baseLatencyMs').value;
/** Users that put this much load on one small server. */
const usersAt = (utilization: number) => (utilization * capacity) / perUser;

function server(id: string): WorkNode {
  return {
    id,
    kind: 'server',
    label: id,
    capacity: n('server.small.capacity'),
    queueMax: n('server.queueMax'),
    baseLatencyMs: n('server.baseLatencyMs'),
    region: 'region-1',
    zone: 'zone-a',
    up: true,
  };
}

const lb: LoadBalancerNode = {
  id: 'lb',
  kind: 'loadBalancer',
  label: 'Load balancer',
  baseLatencyMs: n('lb.baseLatencyMs'),
  healthCheckSeconds: n('lb.healthCheckSeconds'),
  region: 'region-1',
  zone: 'zone-a',
};

/** users → LB → servers a, b, c… */
function balanced(serverIds: string[], users: number, seed = 1): World {
  return {
    nodes: [
      { id: 'users', kind: 'users', label: 'Users', region: 'region-1', zone: 'zone-a' },
      lb,
      ...serverIds.map(server),
    ],
    edges: [
      { id: 'users-lb', from: 'users', to: 'lb' },
      ...serverIds.map((id) => ({ id: `lb-${id}`, from: 'lb', to: id })),
    ],
    traffic: { users, requestsPerUserPerSec: n('traffic.requestsPerUserPerSec') },
    rules: {
      busyAt: n('rules.busyAt'),
      latencyCapAt: n('rules.latencyCapAt'),
      queueBadFraction: n('rules.queueBadFraction'),
      smoothingSeconds: n('rules.smoothingSeconds'),
    },
    seed,
  };
}

function run(state: SimState, seconds: number, firstActions: Action[] = []): SimState {
  let current = step(state, firstActions, DT);
  for (let i = 1; i < Math.round(seconds / DT); i++) current = step(current, [], DT);
  return current;
}

const kill = (nodeId: string): Action => ({ type: 'killNode', nodeId });
const revive = (nodeId: string): Action => ({ type: 'reviveNode', nodeId });

function status(state: SimState, id: string) {
  const found = state.nodes[id];
  if (!found) throw new Error(`no status for ${id}`);
  return found;
}
const edgeRate = (state: SimState, id: string) => state.edges[id]?.rate ?? 0;

// 1,000 users = 100 req/s: one small server at 125%, two at 62.5% each.
const thousandUsers = usersAt(1.25);
const thousandUsersRate = thousandUsers * perUser;

describe('load balancer splits traffic', () => {
  it('two servers at 1,000 users: 50 req/s each, both healthy, no errors', () => {
    const state = run(createState(balanced(['a', 'b'], thousandUsers)), 5);
    expect(status(state, 'a').incoming).toBeCloseTo(thousandUsersRate / 2);
    expect(status(state, 'b').incoming).toBeCloseTo(thousandUsersRate / 2);
    expect(status(state, 'a').health).toBe('ok');
    expect(state.totals.errorRate).toBe(0);
  });

  it('does no work itself: passes everything on, never turns red', () => {
    const state = run(createState(balanced(['a', 'b'], usersAt(10))), 5);
    expect(status(state, 'lb').served).toBeCloseTo(usersAt(10) * perUser);
    expect(status(state, 'lb').dropped).toBe(0);
    expect(status(state, 'lb').health).toBe('ok');
  });

  it('end-to-end latency = LB latency + traffic-weighted server latency', () => {
    const state = run(createState(balanced(['a', 'b'], thousandUsers)), 5);
    const servers = (status(state, 'a').latencyMs + status(state, 'b').latencyMs) / 2;
    expect(state.totals.latencyMs).toBeCloseTo(lbLatency + servers);
  });
});

describe('kill a server', () => {
  const twoServers = () => run(createState(balanced(['a', 'b'], thousandUsers)), 5);

  it('before the LB notices: it still sends half to the dead box, so ~half the requests fail', () => {
    const state = run(twoServers(), healthCheckWindow / 2, [kill('b')]);
    expect(edgeRate(state, 'lb-b')).toBeCloseTo(thousandUsersRate / 2);
    expect(state.totals.errorRate).toBeCloseTo(0.5);
    expect(state.lbView.lb?.b?.seenUp).toBe(true);
  });

  it('after the health-check healthCheckWindow: everything goes to the survivor, which overloads', () => {
    const state = run(twoServers(), healthCheckWindow + 1, [kill('b')]);
    expect(edgeRate(state, 'lb-b')).toBe(0);
    expect(status(state, 'a').incoming).toBeCloseTo(thousandUsersRate);
    expect(status(state, 'a').health).toBe('bad');
    expect(state.lbView.lb?.b?.seenUp).toBe(false);
  });

  it('survivor errors show up once its waiting line fills', () => {
    const state = run(twoServers(), healthCheckWindow + 20, [kill('b')]);
    expect(state.totals.errorRate).toBeGreaterThan(0);
  });

  it('3 servers, kill one: survivors ~62% busy, no errors (N+1)', () => {
    const start = run(createState(balanced(['a', 'b', 'c'], thousandUsers)), 5);
    const state = run(start, healthCheckWindow + 5, [kill('c')]);
    expect(status(state, 'a').utilization).toBeCloseTo(0.625);
    expect(status(state, 'b').utilization).toBeCloseTo(0.625);
    expect(state.totals.errorRate).toBe(0);
  });

  it('dead box is left out of latency, so latency does not look better during the outage', () => {
    const state = run(twoServers(), healthCheckWindow / 2, [kill('b')]);
    expect(state.totals.latencyMs).toBeCloseTo(lbLatency + status(state, 'a').latencyMs);
  });

  it('a waiting line on the killed box is dropped once, then the box shows 0', () => {
    // 2,000 users: each server at 125%, so both build a line.
    const overloaded = run(createState(balanced(['a', 'b'], usersAt(2.5))), 5);
    const line = status(overloaded, 'b').queueLength;
    expect(line).toBeGreaterThan(0);

    const killStep = step(overloaded, [kill('b')], DT);
    const incoming = status(killStep, 'b').incoming;
    expect(status(killStep, 'b').dropped).toBeCloseTo(incoming + line / DT);
    expect(status(killStep, 'b').queueLength).toBe(0);
    expect(killStep.totals.errorRate).toBeLessThanOrEqual(1);

    const next = step(killStep, [], DT);
    expect(status(next, 'b').dropped).toBeCloseTo(status(next, 'b').incoming);
  });

  it('killing a dead box again changes nothing', () => {
    const once = run(twoServers(), 1, [kill('b')]);
    expect(step(once, [kill('b')], DT)).toEqual(step(once, [], DT));
  });

  it('only servers can be killed: anything else throws', () => {
    expect(() => step(twoServers(), [kill('lb')], DT)).toThrow(/server/);
    expect(() => step(twoServers(), [kill('ghost')], DT)).toThrow(/server/);
  });
});

describe('revive a server', () => {
  const killedAndNoticed = () =>
    run(run(createState(balanced(['a', 'b'], thousandUsers)), 5), healthCheckWindow + 1, [
      kill('b'),
    ]);

  it('revived inside the healthCheckWindow: the LB never marks it down', () => {
    let state = run(createState(balanced(['a', 'b'], thousandUsers)), 5);
    state = run(state, healthCheckWindow / 2, [kill('b')]);
    state = run(state, healthCheckWindow, [revive('b')]);
    expect(state.lbView.lb?.b?.seenUp).toBe(true);
    expect(state.totals.errorRate).toBe(0);
  });

  it('revived after the LB marked it down: idle until health checks see it again', () => {
    const state = run(killedAndNoticed(), healthCheckWindow / 2, [revive('b')]);
    expect(edgeRate(state, 'lb-b')).toBe(0);
    expect(status(state, 'b').health).toBe('ok');
  });

  it('after the healthCheckWindow, the split goes back to equal', () => {
    const state = run(killedAndNoticed(), healthCheckWindow + 1, [revive('b')]);
    expect(edgeRate(state, 'lb-a')).toBeCloseTo(thousandUsersRate / 2);
    expect(edgeRate(state, 'lb-b')).toBeCloseTo(thousandUsersRate / 2);
  });

  it('reviving a live box changes nothing', () => {
    const state = run(createState(balanced(['a', 'b'], thousandUsers)), 1);
    expect(step(state, [revive('a')], DT)).toEqual(step(state, [], DT));
  });
});

describe('all servers down', () => {
  it('every request fails, before and after the LB notices, with no division by zero', () => {
    const start = run(createState(balanced(['a', 'b'], thousandUsers)), 5);
    const during = run(start, healthCheckWindow / 2, [kill('a'), kill('b')]);
    expect(during.totals.errorRate).toBeCloseTo(1);

    const after = run(during, healthCheckWindow + 1);
    expect(after.totals.errorRate).toBeCloseTo(1);
    expect(Number.isFinite(after.totals.latencyMs)).toBe(true);
    expect(after.totals.throughput).toBe(0);
  });

  it('fails open: with no target believed up, it keeps splitting across all of them', () => {
    const start = run(createState(balanced(['a', 'b'], thousandUsers)), 5);
    const after = run(start, healthCheckWindow * 2, [kill('a'), kill('b')]);
    expect(edgeRate(after, 'lb-a')).toBeCloseTo(thousandUsersRate / 2);
    expect(edgeRate(after, 'lb-b')).toBeCloseTo(thousandUsersRate / 2);
  });

  it('an LB with no targets turns everything away', () => {
    const base = balanced([], thousandUsers);
    const state = run(createState(base), 1);
    expect(state.totals.errorRate).toBeCloseTo(1);
  });
});

describe('changing the server count', () => {
  it('a new server joins the split right away, with no health-check wait', () => {
    const state = run(createState(balanced(['a', 'b'], thousandUsers)), 5);
    const bigger = step(
      state,
      [{ type: 'replaceWorld', world: balanced(['a', 'b', 'c'], thousandUsers) }],
      DT,
    );
    expect(edgeRate(bigger, 'lb-c')).toBeCloseTo(thousandUsersRate / 3);
  });
});

describe('determinism with kills', () => {
  it('same seed + same actions, run twice ⇒ identical states', () => {
    const script = (start: SimState) => {
      let state = start;
      for (let i = 0; i < 400; i++) {
        const actions: Action[] = i === 50 ? [kill('b')] : i === 200 ? [revive('b')] : [];
        state = step(state, actions, DT);
      }
      return state;
    };
    const world = balanced(['a', 'b'], thousandUsers, 7);
    expect(script(createState(world))).toEqual(script(createState(world)));
  });
});
