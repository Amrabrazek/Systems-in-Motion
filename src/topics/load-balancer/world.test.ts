import { describe, expect, it } from 'vitest';
import { createState, step, type Action, type SimState } from '../../engine';
import { getNumber } from '../../data/numbers';
import { loadBalancerWorld, serversOf, START_USERS, withServerCount } from './world';

const STEP = 0.05;
const healthCheck = getNumber('teaching', 'lb.healthCheckSeconds').value;

function run(state: SimState, seconds: number, actions: Action[] = []): SimState {
  let next = step(state, actions, STEP);
  for (let i = 1; i < seconds / STEP; i++) next = step(next, [], STEP);
  return next;
}

describe('load-balancer lesson world', () => {
  it('starts healthy on two servers', () => {
    const state = run(createState(loadBalancerWorld()), 10);
    expect(state.nodes.a?.health).toBe('ok');
    expect(state.nodes.b?.health).toBe('ok');
    expect(state.totals.errorRate).toBe(0);
  });

  it('kill one of two: the survivor turns red after the health check', () => {
    const calm = run(createState(loadBalancerWorld()), 10);
    const killed = run(calm, healthCheck + 20, [{ type: 'killNode', nodeId: 'b' }]);
    expect(killed.nodes.a?.health).toBe('bad');
    expect(killed.totals.errorRate).toBeGreaterThan(0);
  });

  it('kill one of three: the other two hold (N+1)', () => {
    const calm = run(createState(loadBalancerWorld(START_USERS, 3)), 10);
    const killed = run(calm, healthCheck + 20, [{ type: 'killNode', nodeId: 'c' }]);
    expect(killed.nodes.a?.health).not.toBe('bad');
    expect(killed.totals.errorRate).toBe(0);
  });
});

describe('withServerCount', () => {
  it('adds servers at the end with fresh letters', () => {
    const world = withServerCount(loadBalancerWorld(), 4);
    expect(serversOf(world).map((node) => node.label)).toEqual([
      'Server A',
      'Server B',
      'Server C',
      'Server D',
    ]);
    expect(world.edges.filter((edge) => edge.from === 'lb')).toHaveLength(4);
  });

  it('removes from the end and keeps who is down', () => {
    const three = withServerCount(loadBalancerWorld(), 3);
    const bDown = {
      ...three,
      nodes: three.nodes.map((node) => (node.id === 'b' ? { ...node, up: false } : node)),
    };
    const two = withServerCount(bDown, 2);
    expect(serversOf(two).map((node) => [node.id, node.up])).toEqual([
      ['a', true],
      ['b', false],
    ]);
    expect(two.edges.map((edge) => edge.id)).toEqual(['users-lb', 'lb-a', 'lb-b']);
  });

  it('clamps to 1–4 and keeps the load balancer at 1', () => {
    expect(serversOf(withServerCount(loadBalancerWorld(), 0))).toHaveLength(1);
    expect(serversOf(withServerCount(loadBalancerWorld(), 9))).toHaveLength(4);
    expect(
      withServerCount(loadBalancerWorld(), 1).nodes.some((n) => n.kind === 'loadBalancer'),
    ).toBe(true);
  });

  it('keeps users and traffic as they are', () => {
    const world = withServerCount(loadBalancerWorld(1234), 3);
    expect(world.traffic.users).toBe(1234);
  });
});
