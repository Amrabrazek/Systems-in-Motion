import type { World } from '../../engine';
import { costMeter, type Meter } from '../../ui/shared/meters';
import { cacheOf, databaseOf } from './world';

// The shared meters only know servers and load balancers, so this page adds the cache to them.

function cacheCost(world: World): Meter {
  const shared = costMeter(world);
  if (!cacheOf(world)) return shared;
  // A cache is its own always-on machine with lots of memory: one step up from the servers alone.
  const level: Meter['level'] = shared.level === 1 ? 2 : 3;
  return {
    ...shared,
    level,
    word: level === 3 ? 'expensive' : 'medium',
    why: 'Servers and a load balancer, plus a cache machine with lots of memory.',
  };
}

function cacheComplexity(world: World): Meter {
  return cacheOf(world)
    ? {
        label: 'Complexity',
        level: 3,
        word: 'high',
        look: 'neutral',
        live: false,
        why: 'A cache to run, and every answer might be up to one TTL old.',
      }
    : {
        label: 'Complexity',
        level: 2,
        word: 'medium',
        look: 'neutral',
        live: false,
        why: 'A load balancer and a database to run.',
      };
}

/**
 * Can the database carry every read on its own? That is what it faces with no cache, and
 * again the moment a cache dies or restarts empty.
 */
export function databaseAloneMeter(world: World): Meter {
  const label = 'Database alone';
  const database = databaseOf(world);
  const reads = world.traffic.users * world.traffic.requestsPerUserPerSec.value;
  const capacity = database?.capacity.value ?? 0;
  const utilization = capacity > 0 ? reads / capacity : Infinity;
  if (utilization < world.rules.busyAt.value)
    return {
      label,
      level: 1,
      word: '✓ holds',
      look: 'ok',
      live: true,
      why: 'The database could answer every read by itself.',
    };
  if (utilization <= 1)
    return {
      label,
      level: 2,
      word: '~ tight',
      look: 'warn',
      live: true,
      why: 'The database could answer every read by itself, but slowly.',
    };
  return {
    label,
    level: 3,
    word: '! fails',
    look: 'bad',
    live: true,
    why: 'The database cannot answer every read by itself. Requests will fail.',
  };
}

export const cacheMeters = (world: World): Meter[] => [
  cacheCost(world),
  cacheComplexity(world),
  databaseAloneMeter(world),
];
