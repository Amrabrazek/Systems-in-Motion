import { describe, expect, it } from 'vitest';
import { createRng, nextRandom } from './rng';

function draw(seed: number, count: number): number[] {
  let rng = createRng(seed);
  const values: number[] = [];
  for (let i = 0; i < count; i++) {
    const [value, next] = nextRandom(rng);
    values.push(value);
    rng = next;
  }
  return values;
}

describe('seeded rng', () => {
  it('gives the same sequence for the same seed', () => {
    expect(draw(7, 50)).toEqual(draw(7, 50));
  });

  it('gives a different sequence for a different seed', () => {
    expect(draw(7, 10)).not.toEqual(draw(8, 10));
  });

  it('stays in [0, 1) and spreads out', () => {
    const values = draw(123, 10_000);
    expect(Math.min(...values)).toBeGreaterThanOrEqual(0);
    expect(Math.max(...values)).toBeLessThan(1);
    const mean = values.reduce((sum, value) => sum + value, 0) / values.length;
    expect(mean).toBeCloseTo(0.5, 1);
  });
});
