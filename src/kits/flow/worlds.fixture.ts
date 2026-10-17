// Small worlds for the Flow kit's tests. Not imported by app code.
import { getNumber } from '../../data/numbers';
import type { CacheNode, LoadBalancerNode, World, WorkNode } from '../../engine';

const n = (id: string) => getNumber('teaching', id);

export function server(id: string, label = id): WorkNode {
  return {
    id,
    kind: 'server',
    label,
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
  awsTag: 'ALB',
  baseLatencyMs: n('lb.baseLatencyMs'),
  healthCheckSeconds: n('lb.healthCheckSeconds'),
  region: 'region-1',
  zone: 'zone-a',
};

const base = (users: number): Omit<World, 'nodes' | 'edges'> => ({
  traffic: { users, requestsPerUserPerSec: n('traffic.requestsPerUserPerSec') },
  rules: {
    busyAt: n('rules.busyAt'),
    latencyCapAt: n('rules.latencyCapAt'),
    queueBadFraction: n('rules.queueBadFraction'),
    smoothingSeconds: n('rules.smoothingSeconds'),
  },
  seed: 1,
});

const usersNode = {
  id: 'users',
  kind: 'users',
  label: 'Users',
  region: 'region-1',
  zone: 'zone-a',
};

/** users → one server: the M1 picture. */
export function oneServer(users: number): World {
  return {
    ...base(users),
    nodes: [{ ...usersNode, kind: 'users' }, server('server', 'Server')],
    edges: [{ id: 'users-server', from: 'users', to: 'server' }],
  };
}

/** users → LB → Server A, Server B, … */
export function balanced(count: number, users: number): World {
  const ids = ['a', 'b', 'c', 'd', 'e'].slice(0, count);
  return {
    ...base(users),
    nodes: [
      { ...usersNode, kind: 'users' },
      lb,
      ...ids.map((id) => server(id, `Server ${id.toUpperCase()}`)),
    ],
    edges: [
      { id: 'users-lb', from: 'users', to: 'lb' },
      ...ids.map((id) => ({ id: `lb-${id}`, from: 'lb', to: id })),
    ],
  };
}

const database: WorkNode = {
  id: 'db',
  kind: 'database',
  label: 'Database',
  awsTag: 'RDS',
  capacity: n('db.capacity'),
  queueMax: n('db.queueMax'),
  baseLatencyMs: n('db.baseLatencyMs'),
  region: 'region-1',
  zone: 'zone-a',
  up: true,
};

const cache: CacheNode = {
  id: 'cache',
  kind: 'cache',
  label: 'Cache',
  awsTag: 'ElastiCache',
  baseLatencyMs: n('cache.baseLatencyMs'),
  ttlSeconds: n('cache.ttlSeconds'),
  keyCount: n('cache.keyCount'),
  region: 'region-1',
  zone: 'zone-a',
  up: true,
};

/** users → LB → Server A, Server B → [cache →] database: the topic 3 picture. */
export function cached(users: number, withCache = true): World {
  const world = balanced(2, users);
  const next = withCache ? 'cache' : 'db';
  return {
    ...world,
    nodes: [...world.nodes, ...(withCache ? [cache] : []), database],
    edges: [
      ...world.edges,
      { id: 'a-next', from: 'a', to: next },
      { id: 'b-next', from: 'b', to: next },
      ...(withCache ? [{ id: 'cache-db', from: 'cache', to: 'db' }] : []),
    ],
  };
}
