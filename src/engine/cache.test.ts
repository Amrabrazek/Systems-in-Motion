import { describe, expect, it } from 'vitest';
import { getNumber } from '../data/numbers';
import { nextWarmth, steadyHitRate } from './cache';
import { createState, step } from './step';
import type { Action, CacheNode, NumberEntry, SimState, WorkNode, World } from './types';

// Topic 3 step 1: cache + database in the engine (docs/milestones/topic-3-cache.md, ADR 0014).

const DT = 0.05;
const n = (id: string) => getNumber('teaching', id);
const perUser = n('traffic.requestsPerUserPerSec').value;
const keyCount = n('cache.keyCount').value;
const ttl = n('cache.ttlSeconds').value;
const dbCapacity = n('db.capacity').value;

const place = { region: 'region-1', zone: 'zone-a' };

function server(id: string): WorkNode {
  return {
    id,
    kind: 'server',
    label: id,
    capacity: n('server.small.capacity'),
    queueMax: n('server.queueMax'),
    baseLatencyMs: n('server.baseLatencyMs'),
    ...place,
    up: true,
  };
}

const database: WorkNode = {
  id: 'db',
  kind: 'database',
  label: 'Database',
  capacity: n('db.capacity'),
  queueMax: n('db.queueMax'),
  baseLatencyMs: n('db.baseLatencyMs'),
  ...place,
  up: true,
};

function cacheNode(ttlSeconds: NumberEntry = n('cache.ttlSeconds')): CacheNode {
  return {
    id: 'cache',
    kind: 'cache',
    label: 'Cache',
    baseLatencyMs: n('cache.baseLatencyMs'),
    ttlSeconds,
    keyCount: n('cache.keyCount'),
    ...place,
    up: true,
  };
}

/** users → LB → servers → [cache →] database */
function world(
  users: number,
  options: { serverCount?: number; cache?: CacheNode | null; database?: boolean } = {},
): World {
  const serverIds = Array.from({ length: options.serverCount ?? 2 }, (_, i) => `s${i + 1}`);
  const cache = options.cache === undefined ? cacheNode() : options.cache;
  const hasDatabase = options.database ?? true;
  const afterServers = cache ? 'cache' : 'db';
  return {
    nodes: [
      { id: 'users', kind: 'users', label: 'Users', ...place },
      {
        id: 'lb',
        kind: 'loadBalancer',
        label: 'Load balancer',
        baseLatencyMs: n('lb.baseLatencyMs'),
        healthCheckSeconds: n('lb.healthCheckSeconds'),
        ...place,
      },
      ...serverIds.map(server),
      ...(cache ? [cache] : []),
      ...(hasDatabase ? [database] : []),
    ],
    edges: [
      { id: 'users-lb', from: 'users', to: 'lb' },
      ...serverIds.map((id) => ({ id: `lb-${id}`, from: 'lb', to: id })),
      ...(cache || hasDatabase
        ? serverIds.map((id) => ({ id: `${id}-next`, from: id, to: afterServers }))
        : []),
      ...(cache && hasDatabase ? [{ id: 'cache-db', from: 'cache', to: 'db' }] : []),
    ],
    traffic: { users, requestsPerUserPerSec: n('traffic.requestsPerUserPerSec') },
    rules: {
      busyAt: n('rules.busyAt'),
      latencyCapAt: n('rules.latencyCapAt'),
      queueBadFraction: n('rules.queueBadFraction'),
      smoothingSeconds: n('rules.smoothingSeconds'),
    },
    seed: 1,
  };
}

function run(state: SimState, seconds: number, firstActions: Action[] = []): SimState {
  let current = step(state, firstActions, DT);
  for (let i = 1; i < Math.round(seconds / DT); i++) current = step(current, [], DT);
  return current;
}

function status(state: SimState, id: string) {
  const found = state.nodes[id];
  if (!found) throw new Error(`no status for ${id}`);
  return found;
}
const hitRate = (state: SimState) => state.cacheView.cache?.hitRate ?? 0;
const ttlOf = (value: number): NumberEntry => ({ ...n('cache.ttlSeconds'), value, tag: 'U' });

// 1,000 users = 100 req/s: two servers at 62.5% each, the database alone at 166%.
const users = 1000;
const reads = users * perUser;
const warmSteady = steadyHitRate(reads / keyCount, ttl); // 0.75 with the teaching numbers
const warm = (state: SimState) => run(state, 120);

describe('hit rate from TTL (ADR 0014)', () => {
  it('is r·T / (1 + r·T)', () => {
    expect(steadyHitRate(0.1, 30)).toBeCloseTo(0.75);
  });

  it('is 0 when nothing is kept or nothing is asked', () => {
    expect(steadyHitRate(0.1, 0)).toBe(0);
    expect(steadyHitRate(0, 30)).toBe(0);
  });

  it('goes up with more requests per key: more users means more hits', () => {
    expect(steadyHitRate(0.2, 30)).toBeGreaterThan(steadyHitRate(0.1, 30));
  });

  it('does not warm up without traffic', () => {
    expect(nextWarmth(0, 0, 10)).toBe(0);
    expect(nextWarmth(0.5, 0.1, 1)).toBeGreaterThan(0.5);
  });
});

describe('database behind the servers, no cache', () => {
  it('is the bottleneck at 1,000 users while the servers are fine', () => {
    const state = run(createState(world(users, { cache: null })), 10);
    expect(status(state, 'db').utilization).toBeCloseTo(reads / dbCapacity);
    expect(status(state, 'db').health).toBe('bad');
    expect(status(state, 's1').health).toBe('ok');
    expect(state.totals.errorRate).toBeGreaterThan(0);
  });
});

describe('cache in front of the database', () => {
  it('starts empty, so the database still takes everything at first', () => {
    const state = step(createState(world(users)), [], DT);
    expect(hitRate(state)).toBeLessThan(0.01);
    expect(status(state, 'db').incoming).toBeCloseTo(reads, 0);
  });

  it('once warm, sends only the misses to the database, which turns green', () => {
    const state = warm(createState(world(users)));
    expect(hitRate(state)).toBeCloseTo(warmSteady, 3);
    expect(status(state, 'db').incoming).toBeCloseTo(reads * (1 - warmSteady), 1);
    expect(status(state, 'db').health).toBe('ok');
    expect(state.totals.errorRate).toBe(0);
  });

  it('counts hits as finished: throughput is everything that came in', () => {
    const state = warm(createState(world(users)));
    expect(state.totals.throughput).toBeCloseTo(reads, 1);
  });

  it('with TTL 0 keeps nothing, so every request reaches the database', () => {
    const state = warm(createState(world(users, { cache: cacheNode(ttlOf(0)) })));
    expect(hitRate(state)).toBe(0);
    expect(status(state, 'db').incoming).toBeCloseTo(reads);
  });

  it('with no users has no NaN anywhere', () => {
    const state = run(createState(world(0)), 5);
    expect(hitRate(state)).toBe(0);
    expect(Number.isFinite(state.totals.latencyMs)).toBe(true);
    expect(state.totals.errorRate).toBe(0);
  });

  it('doubling users does not double the database load', () => {
    const fourServers = { serverCount: 4 };
    const before = warm(createState(world(users, fourServers)));
    const after = warm(createState(world(users * 2, fourServers)));
    expect(hitRate(after)).toBeGreaterThan(hitRate(before));
    expect(status(after, 'db').incoming).toBeLessThan(1.5 * status(before, 'db').incoming);
  });

  it('end-to-end latency = LB + server + cache + miss share × database', () => {
    const state = warm(createState(world(users)));
    const expected =
      status(state, 'lb').latencyMs +
      status(state, 's1').latencyMs +
      status(state, 'cache').latencyMs +
      (1 - hitRate(state)) * status(state, 'db').latencyMs;
    expect(state.totals.latencyMs).toBeCloseTo(expected, 6);
  });

  it('turns misses away when there is no database behind it', () => {
    const state = warm(createState(world(users, { database: false })));
    expect(state.totals.errorRate).toBeCloseTo(1 - warmSteady, 3);
  });
});

describe('killing and reviving the cache', () => {
  const kill: Action = { type: 'killNode', nodeId: 'cache' };
  const revive: Action = { type: 'reviveNode', nodeId: 'cache' };

  it('a dead cache passes every request to the database and adds no errors itself', () => {
    const state = step(warm(createState(world(users))), [kill], DT);
    expect(hitRate(state)).toBe(0);
    expect(status(state, 'cache').dropped).toBe(0);
    expect(status(state, 'cache').health).toBe('bad');
    expect(status(state, 'db').incoming).toBeCloseTo(reads, 1);
  });

  it('a dead cache keeps the database in the latency (it is not "down" like a server)', () => {
    const state = run(warm(createState(world(users))), 1, [kill]);
    expect(state.totals.latencyMs).toBeGreaterThan(status(state, 'db').latencyMs);
  });

  it('comes back empty and warms up again (cold start)', () => {
    const dead = run(warm(createState(world(users))), 5, [kill]);
    const justBack = step(dead, [revive], DT);
    expect(hitRate(justBack)).toBeLessThan(0.01);
    const later = run(justBack, 30);
    expect(hitRate(later)).toBeGreaterThan(0.9 * warmSteady);
  });

  it('only servers and caches can be killed', () => {
    const state = createState(world(users));
    expect(() => step(state, [{ type: 'killNode', nodeId: 'db' }], DT)).toThrow();
  });
});

describe('changing the world', () => {
  it('adding a cache starts it cold', () => {
    const noCache = warm(createState(world(users, { cache: null })));
    const added = step(noCache, [{ type: 'replaceWorld', world: world(users) }], DT);
    expect(hitRate(added)).toBeLessThan(0.01);
  });

  it('a cache that keeps its id keeps what it holds (e.g. a new TTL)', () => {
    const warmState = warm(createState(world(users)));
    const longer = world(users, { cache: cacheNode(ttlOf(60)) });
    const next = step(warmState, [{ type: 'replaceWorld', world: longer }], DT);
    expect(hitRate(next)).toBeGreaterThan(warmSteady);
  });

  it('same world + same actions twice gives identical states', () => {
    const actions: Action[] = [{ type: 'killNode', nodeId: 'cache' }];
    const a = run(run(createState(world(users)), 20), 10, actions);
    const b = run(run(createState(world(users)), 20), 10, actions);
    expect(a).toEqual(b);
  });
});
