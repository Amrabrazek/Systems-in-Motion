import type { CacheNode, CacheView, NodeStatus } from './types';

// The cache model (ADR 0014). Standard result for a time-to-live cache: a key asked at a
// steady random rate r and kept T seconds is a hit r·T / (1 + r·T) of the time. Source:
// Jung, Berger, Balakrishnan, "Modeling TTL-based Internet caches", INFOCOM 2003.

export const coldCache: CacheView = { warmth: 0, hitRate: 0 };

/**
 * Share of requests answered from memory once the cache is warm. Every key is assumed equally
 * popular; real traffic is skewed toward a few hot keys, which hits more, so this is the
 * cautious side.
 */
export function steadyHitRate(requestsPerKeyPerSec: number, ttlSeconds: number): number {
  const askedWhileKept = Math.max(0, requestsPerKeyPerSec * ttlSeconds);
  return askedWhileKept / (1 + askedWhileKept);
}

/**
 * Warm-up after a (re)start: each step, every key not fetched yet has a chance
 * 1 − e^(−r·dt) of being asked for, and then it's kept. No traffic, no warming.
 */
export function nextWarmth(warmth: number, requestsPerKeyPerSec: number, dt: number): number {
  const askedThisStep = 1 - Math.exp(-Math.max(0, requestsPerKeyPerSec) * dt);
  return warmth + (1 - warmth) * askedThisStep;
}

/** The cache's state after one step with `incoming` requests/s. A dead cache forgets everything. */
export function nextCacheView(
  cache: CacheNode,
  previous: CacheView | undefined,
  incoming: number,
  dt: number,
): CacheView {
  if (!cache.up) return coldCache;
  const keyCount = cache.keyCount.value;
  const requestsPerKey = keyCount > 0 ? incoming / keyCount : 0;
  const warmth = nextWarmth(previous?.warmth ?? 0, requestsPerKey, dt);
  return { warmth, hitRate: steadyHitRate(requestsPerKey, cache.ttlSeconds.value) * warmth };
}

/**
 * A cache does no work: hits are answered here, misses go on to the next box. A dead cache
 * passes everything on (apps treat a cache error as a miss), so it adds no errors of its own.
 * Misses with nowhere to go are turned away.
 */
export function cacheStatus(
  cache: CacheNode,
  incoming: number,
  misses: number,
  hasNext: boolean,
): NodeStatus {
  return {
    incoming,
    served: incoming,
    dropped: hasNext ? 0 : misses,
    queueLength: 0,
    utilization: 0,
    latencyMs: cache.up ? cache.baseLatencyMs.value : 0,
    health: cache.up ? 'ok' : 'bad',
  };
}
