import { describe, expect, it } from 'vitest';
import { getNumber } from '../data/numbers';
import { flowOrder } from './graph';
import { createState, step } from './step';
import type { Action, SimEdge, SimState, WorkNode, World } from './types';

// M2 step 1: traffic walks the graph hop by hop (docs/milestones/m2-load-balancer-kill.md).

const DT = 0.05;
const n = (id: string) => getNumber('teaching', id);
const capacity = n('server.small.capacity').value;
const perUser = n('traffic.requestsPerUserPerSec').value;
const usersAt = (utilization: number) => (utilization * capacity) / perUser;

function server(id: string, capacityScale = 1): WorkNode {
  const base = n('server.small.capacity');
  return {
    id,
    kind: 'server',
    label: id,
    capacity: { ...base, value: base.value * capacityScale },
    queueMax: n('server.queueMax'),
    baseLatencyMs: n('server.baseLatencyMs'),
    region: 'region-1',
    zone: 'zone-a',
    up: true,
  };
}

const edge = (from: string, to: string): SimEdge => ({ id: `${from}-${to}`, from, to });

function world(servers: WorkNode[], edges: SimEdge[], users: number, seed = 1): World {
  return {
    nodes: [
      { id: 'users', kind: 'users', label: 'Users', region: 'region-1', zone: 'zone-a' },
      ...servers,
    ],
    edges,
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

/** users → web → app: two boxes in a line, the app twice as big. */
const chain = (users: number, seed = 1) =>
  world([server('web'), server('app', 2)], [edge('users', 'web'), edge('web', 'app')], users, seed);

/** users → web → (a, b): the web box hands its work to two equal boxes. */
const fanOut = (users: number) =>
  world(
    [server('web', 2), server('a'), server('b')],
    [edge('users', 'web'), edge('web', 'a'), edge('web', 'b')],
    users,
  );

function run(state: SimState, seconds: number, firstActions: Action[] = []): SimState {
  let current = step(state, firstActions, DT);
  for (let i = 1; i < Math.round(seconds / DT); i++) current = step(current, [], DT);
  return current;
}

const status = (state: SimState, id: string) => {
  const found = state.nodes[id];
  if (!found) throw new Error(`no status for ${id}`);
  return found;
};

describe('traffic flows hop by hop', () => {
  it('a box gets what the box before it served', () => {
    const state = run(createState(chain(usersAt(0.5))), 5);
    expect(status(state, 'app').incoming).toBeCloseTo(status(state, 'web').served);
    expect(state.edges['web-app']?.rate).toBeCloseTo(usersAt(0.5) * perUser);
  });

  it('an overloaded first box shields the next one: it only passes on its capacity', () => {
    const state = run(createState(chain(usersAt(2))), 10);
    expect(status(state, 'web').health).toBe('bad');
    expect(status(state, 'app').incoming).toBeCloseTo(capacity);
    expect(status(state, 'app').health).toBe('ok');
    expect(state.totals.errorRate).toBeCloseTo(0.5, 2);
  });

  it('a box splits what it served evenly across its outgoing edges', () => {
    const state = run(createState(fanOut(usersAt(1))), 5);
    expect(status(state, 'a').incoming).toBeCloseTo(capacity / 2);
    expect(status(state, 'b').incoming).toBeCloseTo(capacity / 2);
  });

  it('drops at every hop count toward the error rate', () => {
    // At 3× a small box: web (2×) drops 1× and passes 2× on; a and b each get exactly 1×.
    const state = run(createState(fanOut(usersAt(3))), 10);
    const dropped = Object.values(state.nodes).reduce((sum, s) => sum + s.dropped, 0);
    expect(dropped).toBeGreaterThan(0);
    expect(state.totals.errorRate).toBeCloseTo(dropped / (usersAt(3) * perUser));
  });

  it('a killed second hop turns away everything the first hop served', () => {
    const base = chain(usersAt(0.5));
    const killed: World = {
      ...base,
      nodes: base.nodes.map((node) => (node.id === 'app' ? { ...node, up: false } : node)),
    };
    const state = run(createState(killed), 2);
    expect(status(state, 'web').health).toBe('ok');
    expect(state.totals.errorRate).toBeCloseTo(1);
    expect(state.totals.throughput).toBe(0);
  });

  it('throughput counts requests finished at the last box, not once per hop', () => {
    const state = run(createState(chain(usersAt(0.5))), 5);
    expect(state.totals.throughput).toBeCloseTo(usersAt(0.5) * perUser);
  });
});

describe('end-to-end latency', () => {
  it('in a line, adds up the boxes on the path', () => {
    const state = run(createState(chain(usersAt(0.5))), 5);
    const expected = status(state, 'web').latencyMs + status(state, 'app').latencyMs;
    expect(state.totals.latencyMs).toBeCloseTo(expected);
  });

  it('after a split, weights each branch by the traffic it carries', () => {
    const base = fanOut(usersAt(0.5));
    // Make b slower so the weighting matters: half the traffic sees a, half sees b.
    const slowB: World = {
      ...base,
      nodes: base.nodes.map((node) =>
        node.id === 'b' && node.kind === 'server'
          ? {
              ...node,
              baseLatencyMs: { ...node.baseLatencyMs, value: node.baseLatencyMs.value * 3 },
            }
          : node,
      ),
    };
    const state = run(createState(slowB), 5);
    const expected =
      status(state, 'web').latencyMs +
      (status(state, 'a').latencyMs + status(state, 'b').latencyMs) / 2;
    expect(state.totals.latencyMs).toBeCloseTo(expected);
  });
});

describe('graph checks', () => {
  it('orders boxes so every box comes after the ones that send to it', () => {
    expect(flowOrder(fanOut(0))).toEqual(['users', 'web', 'a', 'b']);
  });

  it('createState throws on a cycle', () => {
    const looped = world(
      [server('web'), server('app')],
      [edge('users', 'web'), edge('web', 'app'), edge('app', 'web')],
      1,
    );
    expect(() => createState(looped)).toThrow(/cycle/);
  });

  it('replaceWorld throws on a cycle too', () => {
    const looped = world([server('web')], [edge('users', 'web'), edge('web', 'web')], 1);
    expect(() =>
      step(createState(chain(1)), [{ type: 'replaceWorld', world: looped }], DT),
    ).toThrow(/cycle/);
  });

  it('throws on an edge to a box that is not in the world', () => {
    expect(() => createState(world([server('web')], [edge('users', 'ghost')], 1))).toThrow();
  });
});

describe('determinism on a multi-hop world', () => {
  it('same seed + same actions, run twice ⇒ identical states', () => {
    const script = (start: SimState) => {
      let state = start;
      for (let i = 0; i < 300; i++) {
        const actions: Action[] = i === 100 ? [{ type: 'setUsers', users: usersAt(3) }] : [];
        state = step(state, actions, DT);
      }
      return state;
    };
    expect(script(createState(chain(300, 7)))).toEqual(script(createState(chain(300, 7))));
  });
});
