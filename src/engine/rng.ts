import type { RngState } from './types';

// mulberry32: tiny, fast, good enough for visuals and jitter. Not for anything secret.
// The constants are part of the algorithm, not tunable numbers.
const INCREMENT = 0x6d2b79f5;
const SHIFT_A = 15;
const SHIFT_B = 7;
const SHIFT_C = 14;
const MIX = 61;
const UINT32_RANGE = 0x1_0000_0000; // 2^32

export function createRng(seed: number): RngState {
  return { seed: seed >>> 0 };
}

/** Returns a number in [0, 1) and the next RNG state. Pure: the old state is untouched. */
export function nextRandom(rng: RngState): [number, RngState] {
  const seed = (rng.seed + INCREMENT) >>> 0;
  let mixed = seed;
  mixed = Math.imul(mixed ^ (mixed >>> SHIFT_A), mixed | 1);
  mixed ^= mixed + Math.imul(mixed ^ (mixed >>> SHIFT_B), mixed | MIX);
  const value = ((mixed ^ (mixed >>> SHIFT_C)) >>> 0) / UINT32_RANGE;
  return [value, { seed }];
}
