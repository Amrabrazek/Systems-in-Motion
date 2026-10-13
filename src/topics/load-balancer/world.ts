import { getNumber } from '../../data/numbers';
import type { World, WorkNode } from '../../engine';

const n = (id: string) => getNumber('teaching', id);

/** 1,000 users on 2 servers: each ~62% busy, so one kill shows the lesson right away. */
export const START_USERS = 1000;
export const START_SERVERS = 2;
export const MIN_SERVERS = 1;
// The stage gets crowded past 4 (M2 plan, Risks).
export const MAX_SERVERS = 4;

const LETTERS = ['a', 'b', 'c', 'd'] as const;
const LB_ID = 'lb';

function server(letter: string): WorkNode {
  return {
    id: letter,
    kind: 'server',
    label: `Server ${letter.toUpperCase()}`,
    awsTag: 'EC2',
    capacity: n('server.small.capacity'),
    queueMax: n('server.queueMax'),
    baseLatencyMs: n('server.baseLatencyMs'),
    region: 'region-1',
    zone: 'zone-a',
    up: true,
  };
}

/** Users → load balancer → Server A, B, … */
export function loadBalancerWorld(users = START_USERS, servers = START_SERVERS): World {
  const world: World = {
    nodes: [
      { id: 'users', kind: 'users', label: 'Users', region: 'region-1', zone: 'zone-a' },
      {
        id: LB_ID,
        kind: 'loadBalancer',
        label: 'Load balancer',
        awsTag: 'ALB',
        baseLatencyMs: n('lb.baseLatencyMs'),
        healthCheckSeconds: n('lb.healthCheckSeconds'),
        region: 'region-1',
        zone: 'zone-a',
      },
    ],
    edges: [{ id: 'users-lb', from: 'users', to: LB_ID }],
    traffic: { users, requestsPerUserPerSec: n('traffic.requestsPerUserPerSec') },
    rules: {
      busyAt: n('rules.busyAt'),
      latencyCapAt: n('rules.latencyCapAt'),
      queueBadFraction: n('rules.queueBadFraction'),
      smoothingSeconds: n('rules.smoothingSeconds'),
    },
    seed: 1,
  };
  return withServerCount(world, servers);
}

export const serversOf = (world: World): WorkNode[] =>
  world.nodes.filter((node): node is WorkNode => node.kind === 'server');

/**
 * The same world with `count` servers behind the load balancer. Servers come and go from the
 * end (D first), and the ones that stay keep their id, so they keep their up/down state and
 * their waiting line (replaceWorld keeps status by id).
 */
export function withServerCount(world: World, count: number): World {
  const wanted = Math.min(MAX_SERVERS, Math.max(MIN_SERVERS, Math.round(count)));
  const existing = new Map(serversOf(world).map((node) => [node.id, node]));
  const servers = LETTERS.slice(0, wanted).map((letter) => existing.get(letter) ?? server(letter));
  return {
    ...world,
    nodes: [...world.nodes.filter((node) => node.kind !== 'server'), ...servers],
    edges: [
      ...world.edges.filter((edge) => edge.from !== LB_ID),
      ...servers.map((node) => ({ id: `${LB_ID}-${node.id}`, from: LB_ID, to: node.id })),
    ],
  };
}
