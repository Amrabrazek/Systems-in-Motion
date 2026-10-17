import { getNumber } from '../../data/numbers';
import type { CacheNode, NumberEntry, World, WorkNode } from '../../engine';

const n = (id: string) => getNumber('teaching', id);

/** 1,000 users: two servers ~62% busy, the database alone ~166%. The database is the problem. */
export const START_USERS = 1000;
// The TTL slider's range. Past 2 minutes the hit rate barely moves, only the data gets older.
export const MAX_TTL_SECONDS = 120;
export const TTL_STEP_SECONDS = 5;

const CACHE_ID = 'cache';
const DB_ID = 'db';
const SERVER_IDS = ['a', 'b'] as const;
const place = { region: 'region-1', zone: 'zone-a' };

function server(letter: string): WorkNode {
  return {
    id: letter,
    kind: 'server',
    label: `Server ${letter.toUpperCase()}`,
    awsTag: 'EC2',
    capacity: n('server.small.capacity'),
    queueMax: n('server.queueMax'),
    baseLatencyMs: n('server.baseLatencyMs'),
    ...place,
    up: true,
  };
}

const database: WorkNode = {
  id: DB_ID,
  kind: 'database',
  label: 'Database',
  awsTag: 'RDS',
  capacity: n('db.capacity'),
  queueMax: n('db.queueMax'),
  baseLatencyMs: n('db.baseLatencyMs'),
  ...place,
  up: true,
};

function newCache(ttlSeconds: NumberEntry = n('cache.ttlSeconds')): CacheNode {
  return {
    id: CACHE_ID,
    kind: 'cache',
    label: 'Cache',
    awsTag: 'ElastiCache',
    baseLatencyMs: n('cache.baseLatencyMs'),
    ttlSeconds,
    keyCount: n('cache.keyCount'),
    ...place,
    up: true,
  };
}

/** Users → load balancer → Server A, B → [cache →] database. Starts without the cache. */
export function cacheWorld(users = START_USERS, cached = false): World {
  const world: World = {
    nodes: [
      { id: 'users', kind: 'users', label: 'Users', ...place },
      {
        id: 'lb',
        kind: 'loadBalancer',
        label: 'Load balancer',
        awsTag: 'ALB',
        baseLatencyMs: n('lb.baseLatencyMs'),
        healthCheckSeconds: n('lb.healthCheckSeconds'),
        ...place,
      },
      ...SERVER_IDS.map(server),
      database,
    ],
    edges: [
      { id: 'users-lb', from: 'users', to: 'lb' },
      ...SERVER_IDS.map((id) => ({ id: `lb-${id}`, from: 'lb', to: id })),
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
  return withCache(world, cached);
}

export const cacheOf = (world: World): CacheNode | undefined =>
  world.nodes.find((node): node is CacheNode => node.kind === 'cache');

export const databaseOf = (world: World): WorkNode | undefined =>
  world.nodes.find((node): node is WorkNode => node.kind === 'database');

/**
 * The same world with or without the cache between the servers and the database. A cache that
 * stays keeps its id, so it keeps what it holds; a new one starts empty (ADR 0014).
 */
export function withCache(world: World, cached: boolean): World {
  const kept = cacheOf(world);
  const cache = cached ? (kept ?? newCache()) : undefined;
  const afterServers = cache ? CACHE_ID : DB_ID;
  const fromServers = new Set<string>(SERVER_IDS);
  return {
    ...world,
    nodes: [
      ...world.nodes.filter((node) => node.kind !== 'cache' && node.kind !== 'database'),
      ...(cache ? [cache] : []),
      ...world.nodes.filter((node) => node.kind === 'database'),
    ],
    edges: [
      ...world.edges.filter((edge) => !fromServers.has(edge.from) && edge.from !== CACHE_ID),
      ...SERVER_IDS.map((id) => ({ id: `${id}-next`, from: id, to: afterServers })),
      ...(cache ? [{ id: `${CACHE_ID}-${DB_ID}`, from: CACHE_ID, to: DB_ID }] : []),
    ],
  };
}

/** The reader's own TTL: tag U, since they picked it (CLAUDE.md "Content rules"). */
export function withTtl(world: World, seconds: number): World {
  const ttl = Math.min(MAX_TTL_SECONDS, Math.max(0, Math.round(seconds)));
  return {
    ...world,
    nodes: world.nodes.map((node) =>
      node.kind === 'cache'
        ? {
            ...node,
            ttlSeconds: {
              ...node.ttlSeconds,
              value: ttl,
              tag: 'U',
              note: 'Your pick. Longer = more answers from memory, but older data.',
            },
          }
        : node,
    ),
  };
}
