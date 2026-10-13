import { describe, expect, it } from 'vitest';
import { smooth } from './metrics';

describe('smooth (EMA)', () => {
  it('covers ~63% of the gap after one time constant', () => {
    let value = 0;
    for (let i = 0; i < 8; i++) value = smooth(value, 100, 0.05, 0.4);
    expect(value).toBeCloseTo(63.2, 0);
  });

  it('lands in the same place whatever the step size', () => {
    let fine = 0;
    for (let i = 0; i < 40; i++) fine = smooth(fine, 100, 0.025, 0.4);
    const coarse = smooth(0, 100, 1, 0.4);
    expect(fine).toBeCloseTo(coarse, 6);
  });
});
