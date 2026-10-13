import { describe, expect, it } from 'vitest';
import { getNumber } from '../data/numbers';
import { survivesLosingOne } from './spare';
import type { WorkNode, World } from './types';

const n = (id: string) => getNumber('teaching', id);
const capacity = n('server.small.capacity').value;
const perUser = n('traffic.requestsPerUserPerSec').value;
const busyAt = n('rules.busyAt').value;
/** Users that put this much load on `servers` small servers. */
const usersAt = (utilization: number, servers: number) =>
  (utilization * capacity * servers) / perUser;

function server(id: string, up = true): WorkNode {
  return {
    id,
    kind: 'server',
    label: id,
    capacity: n('server.small.capacity'),
    queueMax: n('server.queueMax'),
    baseLatencyMs: n('server.baseLatencyMs'),
    region: 'region-1',
    zone: 'zone-a',
    up,
  };
}

function world(servers: WorkNode[], users: number): World {
  return {
    nodes: [
      { id: 'users', kind: 'users', label: 'Users', region: 'region-1', zone: 'zone-a' },
      ...servers,
    ],
    edges: [],
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

describe('survives losing one server', () => {
  it('one server never survives a loss, even with no users', () => {
    expect(survivesLosingOne(world([server('a')], 0))).toBe('no');
  });

  it('two servers at the start of the LB page: the survivor would be over capacity', () => {
    expect(survivesLosingOne(world([server('a'), server('b')], 1000))).toBe('no');
  });

  it('three servers at the same load: the other two hold (N+1)', () => {
    expect(survivesLosingOne(world([server('a'), server('b'), server('c')], 1000))).toBe('yes');
  });

  it('is tight when the survivors would hold but run past busy', () => {
    const between = (busyAt + 1) / 2;
    expect(survivesLosingOne(world([server('a'), server('b')], usersAt(between, 1)))).toBe('tight');
  });

  it('counts only live servers: one already dead means "lose one more"', () => {
    const users = usersAt(busyAt / 2, 1);
    expect(survivesLosingOne(world([server('a'), server('b')], users))).toBe('yes');
    expect(survivesLosingOne(world([server('a'), server('b', false)], users))).toBe('no');
  });

  it('all servers dead is a plain no', () => {
    expect(survivesLosingOne(world([server('a', false), server('b', false)], 10))).toBe('no');
  });
});
