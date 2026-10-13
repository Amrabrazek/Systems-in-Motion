import { describe, expect, it } from 'vitest';
import { niceMax, withAlpha } from './chartMath';

describe('chart helpers', () => {
  it('rounds the axis top up to the next readable step', () => {
    const steps = [200, 500, 1000, 2000, 5000];
    expect(niceMax(57, steps)).toBe(200);
    expect(niceMax(1200, steps)).toBe(2000);
    expect(niceMax(99_999, steps)).toBe(5000);
  });

  it('adds transparency to a hex token value', () => {
    expect(withAlpha('#2f5bd3', 0.12)).toBe('rgba(47, 91, 211, 0.12)');
    expect(withAlpha('rebeccapurple', 0.5)).toBe('rebeccapurple');
  });
});
