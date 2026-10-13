import { describe, expect, it } from 'vitest';
import { positionToValue, roundNicely, valueToPosition } from './logScale';

const scale = { min: 10, max: 10_000, steps: 300 };

describe('log-scale users slider', () => {
  it('maps the ends to min and max', () => {
    expect(positionToValue(scale, 0)).toBe(10);
    expect(positionToValue(scale, 300)).toBe(10_000);
  });

  it('puts 100 and 1,000 users at one third and two thirds', () => {
    expect(positionToValue(scale, 100)).toBe(100);
    expect(positionToValue(scale, 200)).toBe(1000);
  });

  it('round-trips a value to the same position', () => {
    for (const users of [10, 100, 500, 1000, 10_000]) {
      expect(positionToValue(scale, valueToPosition(scale, users))).toBe(users);
    }
  });

  it('every slider step moves forward: no two neighbours give fewer users', () => {
    for (let position = 1; position <= scale.steps; position++) {
      expect(positionToValue(scale, position)).toBeGreaterThanOrEqual(
        positionToValue(scale, position - 1),
      );
    }
  });

  it('clamps out-of-range input', () => {
    expect(positionToValue(scale, -5)).toBe(10);
    expect(valueToPosition(scale, 1e9)).toBe(300);
  });

  it('rounds to two significant figures past 100', () => {
    expect(roundNicely(1234)).toBe(1200);
    expect(roundNicely(87.4)).toBe(87);
    expect(roundNicely(9960)).toBe(10_000);
  });
});
