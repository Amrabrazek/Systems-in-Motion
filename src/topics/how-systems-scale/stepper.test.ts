import { describe, expect, it } from 'vitest';
import { moveStep, stepForKey } from './stepper';

describe('stepper', () => {
  it('moves one step and stops at both ends', () => {
    expect(moveStep(0, 1, 10)).toBe(1);
    expect(moveStep(0, -1, 10)).toBe(0);
    expect(moveStep(9, 1, 10)).toBe(9);
  });

  it('maps arrow, Home and End keys, and ignores the rest', () => {
    expect(stepForKey('ArrowRight', 3, 10)).toBe(4);
    expect(stepForKey('ArrowLeft', 3, 10)).toBe(2);
    expect(stepForKey('Home', 3, 10)).toBe(0);
    expect(stepForKey('End', 3, 10)).toBe(9);
    expect(stepForKey('a', 3, 10)).toBeUndefined();
  });
});
