import { describe, expect, it } from 'vitest';
import { peopleShown, QUEUE_SLOTS, slotsFilled } from './stageMath';

describe('stage picture', () => {
  it('lights more people as users grow, but never 0 for some users or more than the grid', () => {
    expect(peopleShown(0)).toBe(0);
    expect(peopleShown(10)).toBe(1);
    expect(peopleShown(100)).toBeLessThan(peopleShown(1000));
    expect(peopleShown(1_000_000)).toBe(12);
  });

  it('shows one waiting request as one slot, and a full line as every slot', () => {
    expect(slotsFilled(0, 150)).toBe(0);
    expect(slotsFilled(0.4, 150)).toBe(1);
    expect(slotsFilled(150, 150)).toBe(QUEUE_SLOTS);
  });
});
