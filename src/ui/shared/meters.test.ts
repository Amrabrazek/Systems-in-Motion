import { describe, expect, it } from 'vitest';
import { getNumber } from '../../data/numbers';
import type { SimNode, WorkNode, World } from '../../engine';
import { complexityMeter, costLevel, lossMeter, meters } from './meters';

const n = (id: string) => getNumber('teaching', id);

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

const lb: SimNode = {
  id: 'lb',
  kind: 'loadBalancer',
  label: 'Load balancer',
  baseLatencyMs: n('lb.baseLatencyMs'),
  healthCheckSeconds: n('lb.healthCheckSeconds'),
  region: 'region-1',
  zone: 'zone-a',
};

function world(servers: WorkNode[], users: number, withLb = true): World {
  return {
    nodes: [
      { id: 'users', kind: 'users', label: 'Users', region: 'region-1', zone: 'zone-a' },
      ...(withLb ? [lb] : []),
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

const many = (count: number) => ['a', 'b', 'c', 'd', 'e'].slice(0, count).map((id) => server(id));

describe('cost meter', () => {
  it('reads cheap, then medium, then expensive as servers are added', () => {
    expect(costLevel(world(many(1), 0, false))).toBe('cheap');
    expect(costLevel(world(many(2), 0))).toBe('medium');
    expect(costLevel(world(many(4), 0))).toBe('expensive');
  });

  it('still counts a killed server: it is still on the bill', () => {
    const killed = [server('a'), server('b'), server('c'), server('d', false)];
    expect(costLevel(world(killed, 0))).toBe('expensive');
  });
});

describe('complexity meter', () => {
  it('goes up one step when a load balancer joins', () => {
    expect(complexityMeter(world(many(1), 0, false)).level).toBe(1);
    expect(complexityMeter(world(many(2), 0)).level).toBe(2);
  });
});

describe('loss meter (live)', () => {
  it('fails at the LB page start (2 servers, 1,000 users) and holds with a spare', () => {
    expect(lossMeter(world(many(2), 1000))).toMatchObject({ word: '! fails', look: 'bad' });
    expect(lossMeter(world(many(3), 1000))).toMatchObject({ word: '✓ holds', look: 'ok' });
  });

  it('moves with users alone, design unchanged', () => {
    expect(lossMeter(world(many(2), 100)).look).toBe('ok');
    expect(lossMeter(world(many(2), 5000)).look).toBe('bad');
  });

  it('always shows a symbol and a word, never color alone', () => {
    for (const users of [100, 700, 5000]) {
      expect(lossMeter(world(many(2), users)).word).toMatch(/^[✓~!] \w+/);
    }
  });
});

describe('meters', () => {
  it('only the loss meter is live: cost and complexity move with the design, not the load', () => {
    const live = meters(world(many(2), 1000)).map((meter) => [meter.label, meter.live]);
    expect(live).toEqual([
      ['Cost', false],
      ['Complexity', false],
      ['If 1 server dies', true],
    ]);
  });
});
