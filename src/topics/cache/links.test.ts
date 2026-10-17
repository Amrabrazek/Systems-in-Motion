import { describe, expect, it } from 'vitest';
import { availableLinks, highlightFor, idsForLink, linkForNode } from './links';
import { cacheWorld, withCache } from './world';

describe('cache tradeoff links', () => {
  const cached = withCache(cacheWorld(), true);
  const plain = cacheWorld();

  it('lights the cache for the fix and the database for what breaks next', () => {
    expect(idsForLink(cached, 'fix')).toEqual(new Set(['cache']));
    expect(idsForLink(cached, 'limit')).toEqual(new Set(['db']));
  });

  it('offers only the database row while there is no cache to light', () => {
    expect(availableLinks(plain)).toEqual(['limit']);
    expect(availableLinks(cached)).toEqual(['fix', 'limit']);
    expect(idsForLink(plain, 'fix').size).toBe(0);
  });

  it('points a box at its rows', () => {
    expect(linkForNode(cached, 'cache')).toBe('fix');
    expect(linkForNode(cached, 'db')).toBe('limit');
    expect(linkForNode(cached, 'a')).toBeUndefined();
  });

  it('has no highlight when nothing is pointed at', () => {
    expect(highlightFor(cached, undefined)).toBeUndefined();
    expect(highlightFor(cached, 'fix')?.tone).toBe('fix');
  });
});
