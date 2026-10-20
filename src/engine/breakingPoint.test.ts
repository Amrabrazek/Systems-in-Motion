import { describe, expect, it } from 'vitest';
import { getNumber } from '../data/numbers';
import { findBreakingPoint, type BreakingPointOptions } from './breakingPoint';
import type { CacheNode, LoadBalancerNode, SimEdge, SimNode, WorkNode, World } from './types';

// M4 step 1: the headless breaking-point search (docs/milestones/m4-design-v0.md).

const n = (id: string) => getNumber('teaching', id);
const perUser = n('traffic.requestsPerUserPerSec').value;
const smallCapacity = n('server.small.capacity').value;
const dbCapacity = n('db.capacity').value;
const place = { region: 'region-1', zone: 'zone-a' };

const options: BreakingPointOptions = {
  startUsers: n('breakingPoint.startUsers').value,
  maxUsers: n('breakingPoint.maxUsers').value,
  runSeconds: n('breakingPoint.runSeconds').value,
  precision: n('breakingPoint.precision').value,
  maxErrorRate: n('breakingPoint.maxErrorRate').value,
  maxLatencyMs: n('ux.feelsSlowMs').value,
  stepSeconds: 0.05,
};

/** Users at which `capacity` req/s is exactly full. */
const fullAt = (capacity: number) => capacity / perUser;

function server(id: string, up = true): WorkNode {
  return {
    id,
    kind: 'server',
    label: id,
    capacity: n('server.small.capacity'),
    queueMax: n('server.queueMax'),
    baseLatencyMs: n('server.baseLatencyMs'),
    ...place,
    up,
  };
}

const database: WorkNode = {
  ...server('db'),
  kind: 'database',
  capacity: n('db.capacity'),
  queueMax: n('db.queueMax'),
  baseLatencyMs: n('db.baseLatencyMs'),
};

const lb: LoadBalancerNode = {
  id: 'lb',
  kind: 'loadBalancer',
  label: 'lb',
  baseLatencyMs: n('lb.baseLatencyMs'),
  healthCheckSeconds: n('lb.healthCheckSeconds'),
  ...place,
};

const cache: CacheNode = {
  id: 'cache',
  kind: 'cache',
  label: 'cache',
  baseLatencyMs: n('cache.baseLatencyMs'),
  ttlSeconds: n('cache.ttlSeconds'),
  keyCount: n('cache.keyCount'),
  ...place,
  up: true,
};

const edge = (from: string, to: string): SimEdge => ({ id: `${from}-${to}`, from, to });

function world(nodes: SimNode[], edges: SimEdge[]): World {
  return {
    nodes: [{ id: 'users', kind: 'users', label: 'Users', ...place }, ...nodes],
    edges,
    traffic: { users: 0, requestsPerUserPerSec: n('traffic.requestsPerUserPerSec') },
    rules: {
      busyAt: n('rules.busyAt'),
      latencyCapAt: n('rules.latencyCapAt'),
      queueBadFraction: n('rules.queueBadFraction'),
      smoothingSeconds: n('rules.smoothingSeconds'),
    },
    seed: 1,
  };
}

const oneServer = () => world([server('a')], [edge('users', 'a')]);

/** users → LB → servers → [cache →] database */
function chain(servers: WorkNode[], cached = false): World {
  const afterServers = cached ? 'cache' : 'db';
  return world(
    [lb, ...servers, ...(cached ? [cache] : []), database],
    [
      edge('users', 'lb'),
      ...servers.map((box) => edge('lb', box.id)),
      ...servers.map((box) => edge(box.id, afterServers)),
      ...(cached ? [edge('cache', 'db')] : []),
    ],
  );
}

const threeServers = () => [server('a'), server('b'), server('c')];

/** The answer lands just past the exact break, within the search precision. */
function expectNear(users: number, exact: number) {
  expect(users).toBeGreaterThan(exact);
  expect(users).toBeLessThanOrEqual(exact * (1 + options.precision) + 1);
}

describe('findBreakingPoint', () => {
  it('one small server breaks once its capacity is full, at the server', () => {
    const result = findBreakingPoint(oneServer(), options);
    if (!result.breaks) throw new Error('expected a break');
    expectNear(result.users, fullAt(smallCapacity));
    expect(result.lastHeld).toBeLessThanOrEqual(fullAt(smallCapacity));
    expect(result.firstNodeId).toBe('a');
    expect(result.reason).toBe('capacity');
  });

  it('with three servers and no cache, the database breaks first', () => {
    const result = findBreakingPoint(chain(threeServers()), options);
    if (!result.breaks) throw new Error('expected a break');
    expectNear(result.users, fullAt(dbCapacity));
    expect(result.firstNodeId).toBe('db');
  });

  it('a warm cache moves the break later and off the database', () => {
    const before = findBreakingPoint(chain(threeServers()), options);
    const after = findBreakingPoint(chain(threeServers(), true), options);
    if (!before.breaks || !after.breaks) throw new Error('expected breaks');
    expect(after.users).toBeGreaterThan(before.users);
    expect(after.firstNodeId).not.toBe('db');
  });

  it('losing one of two servers halves where it breaks', () => {
    const both = findBreakingPoint(withoutDb([server('a'), server('b')]), options);
    const oneDead = findBreakingPoint(withoutDb([server('a'), server('b', false)]), options);
    if (!both.breaks || !oneDead.breaks) throw new Error('expected breaks');
    expectNear(both.users, fullAt(2 * smallCapacity));
    expectNear(oneDead.users, fullAt(smallCapacity));
    expect(oneDead.firstNodeId).toBe('a');
  });

  it('gives the same answer every time (deterministic)', () => {
    const design = chain(threeServers(), true);
    expect(findBreakingPoint(design, options)).toEqual(findBreakingPoint(design, options));
  });

  it('reports "holds" when the search cap is reached, without looping forever', () => {
    const capped = { ...options, maxUsers: fullAt(smallCapacity) / 2 };
    expect(findBreakingPoint(oneServer(), capped)).toEqual({
      breaks: false,
      heldUpTo: capped.maxUsers,
    });
  });

  it('ignores the users already set on the world', () => {
    const busy = { ...oneServer(), traffic: { ...oneServer().traffic, users: 5000 } };
    expect(findBreakingPoint(busy, options)).toEqual(findBreakingPoint(oneServer(), options));
  });

  it('with every server down, it breaks at the first user, on errors', () => {
    const result = findBreakingPoint(withoutDb([server('a', false)]), options);
    if (!result.breaks) throw new Error('expected a break');
    expect(result.users).toBe(1);
    expect(result.reason).toBe('errors');
    expect(result.firstNodeId).toBe('a');
  });

  it('a box that is slow even when idle breaks on latency', () => {
    const slow: WorkNode = {
      ...server('a'),
      baseLatencyMs: { ...n('server.baseLatencyMs'), value: 2 * options.maxLatencyMs },
    };
    const result = findBreakingPoint(world([slow], [edge('users', 'a')]), options);
    if (!result.breaks) throw new Error('expected a break');
    expect(result.reason).toBe('latency');
    expect(result.firstNodeId).toBe('a');
  });
});

/** users → LB → servers, nothing behind them. */
function withoutDb(servers: WorkNode[]): World {
  return world(
    [lb, ...servers],
    [edge('users', 'lb'), ...servers.map((box) => edge('lb', box.id))],
  );
}
