import { describe, expect, it } from 'vitest';
import { getNumber } from '../../data/numbers';
import { cacheMeters, databaseAloneMeter } from './meters';
import { cacheWorld, withCache } from './world';

const perUser = getNumber('teaching', 'traffic.requestsPerUserPerSec').value;
const dbCapacity = getNumber('teaching', 'db.capacity').value;
const usersFor = (utilization: number) => Math.round((utilization * dbCapacity) / perUser);

describe('cache page meters', () => {
  it('says the database cannot carry every read alone at the start (1,000 users)', () => {
    expect(databaseAloneMeter(cacheWorld()).word).toBe('! fails');
  });

  it('holds at low load and is tight just under full', () => {
    expect(databaseAloneMeter(cacheWorld(usersFor(0.3))).word).toBe('✓ holds');
    expect(databaseAloneMeter(cacheWorld(usersFor(0.95))).word).toBe('~ tight');
  });

  it('is the same with or without a cache: it is the risk the cache hides', () => {
    expect(databaseAloneMeter(withCache(cacheWorld(), true))).toEqual(
      databaseAloneMeter(cacheWorld()),
    );
  });

  it('adding a cache costs more and adds complexity', () => {
    const [costBefore, complexityBefore] = cacheMeters(cacheWorld());
    const [costAfter, complexityAfter] = cacheMeters(withCache(cacheWorld(), true));
    expect(costAfter?.level).toBeGreaterThan(costBefore?.level ?? 0);
    expect(complexityAfter?.level).toBeGreaterThan(complexityBefore?.level ?? 0);
  });
});
