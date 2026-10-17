import { describe, expect, it } from 'vitest';
import { highlightFor, idsForLink, linkForNode } from './links';
import { loadBalancerWorld, serversOf } from './world';

describe('load balancer tradeoff links', () => {
  const world = loadBalancerWorld(1000, 3);
  const [first, second, third] = serversOf(world);
  const balancer = world.nodes.find((node) => node.kind === 'loadBalancer');

  it('lights the balancer and the second server for the fix', () => {
    expect(idsForLink(world, 'fix')).toEqual(new Set([balancer?.id, second?.id]));
  });

  it('lights every server for what breaks next', () => {
    expect(idsForLink(world, 'limit')).toEqual(new Set([first?.id, second?.id, third?.id]));
  });

  it('lights only the balancer for the fix when one server is left', () => {
    expect(idsForLink(loadBalancerWorld(1000, 1), 'fix')).toEqual(new Set([balancer?.id]));
  });

  it('points a box at its rows: servers at the limit, the balancer at the fix', () => {
    expect(linkForNode(world, second?.id ?? '')).toBe('limit');
    expect(linkForNode(world, balancer?.id ?? '')).toBe('fix');
    expect(linkForNode(world, 'users')).toBeUndefined();
  });

  it('has no highlight when nothing is pointed at', () => {
    expect(highlightFor(world, undefined)).toBeUndefined();
    expect(highlightFor(world, 'limit')?.tone).toBe('limit');
  });
});
