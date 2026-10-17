import { describe, expect, it } from 'vitest';
import { createState, step, type Action, type SimState } from '../../engine';
import { cacheOf, cacheWorld, START_USERS, withCache, withTtl } from './world';

const STEP = 0.05;

function run(state: SimState, seconds: number, actions: Action[] = []): SimState {
  let next = step(state, actions, STEP);
  for (let i = 1; i < seconds / STEP; i++) next = step(next, [], STEP);
  return next;
}

const hitRate = (state: SimState) => state.cacheView.cache?.hitRate ?? 0;
const addCache = (state: SimState): Action => ({
  type: 'replaceWorld',
  world: withCache(state.world, true),
});

// The lesson, in order (docs/milestones/topic-3-cache.md).
describe('cache lesson world', () => {
  it('starts with no cache: servers fine, database overloaded', () => {
    const state = run(createState(cacheWorld()), 10);
    expect(state.nodes.a?.health).toBe('ok');
    expect(state.nodes.db?.health).toBe('bad');
    expect(state.totals.errorRate).toBeGreaterThan(0);
  });

  it('add a cache: once warm, the database recovers and nothing fails', () => {
    const before = run(createState(cacheWorld()), 10);
    const after = run(before, 120, [addCache(before)]);
    expect(after.nodes.db?.health).toBe('ok');
    expect(after.smoothed.errorRate).toBeLessThan(0.001);
  });

  it('kill the cache: every read goes to the database again', () => {
    const warm = run(createState(cacheWorld(START_USERS, true)), 120);
    const killed = run(warm, 20, [{ type: 'killNode', nodeId: 'cache' }]);
    expect(killed.nodes.db?.health).toBe('bad');
  });

  it('TTL 0 keeps nothing, a longer TTL keeps more', () => {
    const warm = run(createState(cacheWorld(START_USERS, true)), 120);
    const none = run(warm, 5, [{ type: 'replaceWorld', world: withTtl(warm.world, 0) }]);
    const longer = run(warm, 5, [{ type: 'replaceWorld', world: withTtl(warm.world, 120) }]);
    expect(hitRate(none)).toBe(0);
    expect(hitRate(longer)).toBeGreaterThan(hitRate(warm));
  });

  it('removing and re-adding the cache brings it back empty', () => {
    const warm = run(createState(cacheWorld(START_USERS, true)), 120);
    const removed = run(warm, 1, [{ type: 'replaceWorld', world: withCache(warm.world, false) }]);
    const back = step(removed, [addCache(removed)], STEP);
    expect(hitRate(back)).toBeLessThan(0.01);
  });
});

describe('withCache', () => {
  it('chains servers → cache → database, and back to servers → database', () => {
    const cached = withCache(cacheWorld(), true);
    expect(cached.edges.map((edge) => `${edge.from}→${edge.to}`)).toEqual([
      'users→lb',
      'lb→a',
      'lb→b',
      'a→cache',
      'b→cache',
      'cache→db',
    ]);
    const plain = withCache(cached, false);
    expect(cacheOf(plain)).toBeUndefined();
    expect(plain.edges.map((edge) => `${edge.from}→${edge.to}`)).toEqual([
      'users→lb',
      'lb→a',
      'lb→b',
      'a→db',
      'b→db',
    ]);
  });

  it('keeps a cache that stays, with its TTL and up/down state', () => {
    const cached = withTtl(withCache(cacheWorld(1234), true), 60);
    const again = withCache(cached, true);
    expect(cacheOf(again)?.ttlSeconds.value).toBe(60);
    expect(again.traffic.users).toBe(1234);
  });
});

describe('withTtl', () => {
  it('tags the reader’s pick as their own and clamps it to 0–120 s', () => {
    const cached = withCache(cacheWorld(), true);
    expect(cacheOf(withTtl(cached, 45))?.ttlSeconds).toMatchObject({ value: 45, tag: 'U' });
    expect(cacheOf(withTtl(cached, -5))?.ttlSeconds.value).toBe(0);
    expect(cacheOf(withTtl(cached, 999))?.ttlSeconds.value).toBe(120);
  });

  it('does nothing without a cache', () => {
    const world = cacheWorld();
    expect(withTtl(world, 10)).toEqual(world);
  });
});
