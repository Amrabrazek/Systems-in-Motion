import { describe, expect, it } from 'vitest';
import { getNumber } from '../data/numbers';
import { createState, step } from './step';
import type { Action, SimState, World } from './types';

const DT = 0.05;
const n = (id: string) => getNumber('teaching', id);

function oneServerWorld(users: number, seed = 1): World {
  return {
    nodes: [
      { id: 'users', kind: 'users', label: 'Users', region: 'region-1', zone: 'zone-a' },
      {
        id: 'server',
        kind: 'server',
        label: 'Server',
        awsTag: 'EC2',
        capacity: n('server.small.capacity'),
        queueMax: n('server.queueMax'),
        baseLatencyMs: n('server.baseLatencyMs'),
        region: 'region-1',
        zone: 'zone-a',
        up: true,
      },
    ],
    edges: [{ id: 'users-server', from: 'users', to: 'server' }],
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

const capacity = n('server.small.capacity').value;
const perUser = n('traffic.requestsPerUserPerSec').value;
const queueMax = n('server.queueMax').value;
const baseLatency = n('server.baseLatencyMs').value;

/** Users needed to make the server this busy. */
const usersAt = (utilization: number) => (utilization * capacity) / perUser;

function run(state: SimState, seconds: number, firstActions: Action[] = []): SimState {
  let current = step(state, firstActions, DT);
  for (let i = 1; i < Math.round(seconds / DT); i++) current = step(current, [], DT);
  return current;
}

const server = (state: SimState) => {
  const status = state.nodes.server;
  if (!status) throw new Error('no server status');
  return status;
};

describe('one server under load (docs/milestones/m1-one-box-breaks.md)', () => {
  it('at 50% busy for 10 s: no queue, no errors, healthy', () => {
    const state = run(createState(oneServerWorld(usersAt(0.5))), 10);
    expect(server(state).utilization).toBeCloseTo(0.5);
    expect(server(state).queueLength).toBe(0);
    expect(state.totals.errorRate).toBe(0);
    expect(server(state).health).toBe('ok');
  });

  it('at 85% busy: busy (warn), and latency more than 2× the idle time', () => {
    const state = run(createState(oneServerWorld(usersAt(0.85))), 10);
    expect(server(state).health).toBe('warn');
    expect(server(state).latencyMs).toBeGreaterThan(2 * baseLatency);
  });

  it('at 200% busy for 10 s: line full, about half the requests turned away, overloaded', () => {
    const state = run(createState(oneServerWorld(usersAt(2))), 10);
    expect(server(state).queueLength).toBeCloseTo(queueMax);
    expect(state.totals.errorRate).toBeCloseTo(0.5, 2);
    expect(server(state).health).toBe('bad');
  });

  it('when load drops back to 50%, the line drains to 0 within a few seconds', () => {
    const overloaded = run(createState(oneServerWorld(usersAt(2))), 10);
    const recovered = run(overloaded, 5, [{ type: 'setUsers', users: usersAt(0.5) }]);
    expect(server(recovered).queueLength).toBe(0);
    expect(recovered.totals.errorRate).toBe(0);
    expect(server(recovered).health).toBe('ok');
  });

  it('1,000 users with the teaching numbers breaks the server (the lesson’s promise)', () => {
    const state = run(createState(oneServerWorld(1000)), 20);
    expect(state.totals.errorRate).toBeGreaterThan(0);
    expect(server(state).health).toBe('bad');
  });

  it('never serves more than its capacity, and served + dropped never exceeds what came in', () => {
    let state = createState(oneServerWorld(usersAt(3)));
    for (let i = 0; i < 400; i++) {
      state = step(state, [], DT);
      expect(server(state).served).toBeLessThanOrEqual(capacity + 1e-9);
      expect(server(state).queueLength).toBeLessThanOrEqual(queueMax + 1e-9);
    }
  });

  it('a killed server turns every request away', () => {
    const world = oneServerWorld(usersAt(0.5));
    const killed: World = {
      ...world,
      nodes: world.nodes.map((node) => (node.kind === 'server' ? { ...node, up: false } : node)),
    };
    const state = step(createState(killed), [], DT);
    expect(state.totals.errorRate).toBe(1);
    expect(server(state).health).toBe('bad');
  });

  it('puts the request rate on the edge, so the UI can sample dots from it', () => {
    const state = step(createState(oneServerWorld(500)), [], DT);
    expect(state.edges['users-server']?.rate).toBeCloseTo(500 * perUser);
  });
});

describe('determinism', () => {
  it('same seed + same actions, run twice ⇒ identical states', () => {
    const script = (start: SimState) => {
      let state = start;
      for (let i = 0; i < 300; i++) {
        const actions: Action[] = i === 100 ? [{ type: 'setUsers', users: 2000 }] : [];
        state = step(state, actions, DT);
      }
      return state;
    };
    const first = script(createState(oneServerWorld(300, 42)));
    const second = script(createState(oneServerWorld(300, 42)));
    expect(second).toEqual(first);
  });

  it('does not change the state it was given', () => {
    const start = createState(oneServerWorld(2000));
    const copy = structuredClone(start);
    step(start, [{ type: 'setUsers', users: 10 }], DT);
    expect(start).toEqual(copy);
  });
});

describe('actions', () => {
  it('setUsers never goes below 0', () => {
    const state = step(createState(oneServerWorld(100)), [{ type: 'setUsers', users: -5 }], DT);
    expect(state.world.traffic.users).toBe(0);
  });

  it('replaceWorld keeps the waiting line of a server that is still there', () => {
    const overloaded = run(createState(oneServerWorld(usersAt(2))), 10);
    const next = step(overloaded, [{ type: 'replaceWorld', world: oneServerWorld(0) }], DT);
    expect(server(next).queueLength).toBeGreaterThan(0);
  });

  it('rejects a step of zero or negative time', () => {
    expect(() => step(createState(oneServerWorld(1)), [], 0)).toThrow();
  });
});

describe('smoothed totals (what charts draw)', () => {
  it('trail the raw numbers, then catch up', () => {
    const start = createState(oneServerWorld(usersAt(2)));
    // The line fills just before 2 s; right after, the chart is still catching up.
    const early = run(start, 2.1);
    expect(early.smoothed.errorRate).toBeLessThan(early.totals.errorRate * 0.6);
    const later = run(early, 5);
    expect(later.smoothed.errorRate).toBeCloseTo(later.totals.errorRate, 2);
  });
});
