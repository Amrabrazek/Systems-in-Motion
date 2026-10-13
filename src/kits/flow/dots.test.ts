import { describe, expect, it } from 'vitest';
import { createState, step, type SimState } from '../../engine';
import { getNumber } from '../../data/numbers';
import { dotsPerSecond, emptyField, requestsPerDot, updateDots, type DotField } from './dots';
import { STAGE } from './stageMath';

const n = (id: string) => getNumber('teaching', id);
const world = (users: number) => ({
  nodes: [
    { id: 'users', kind: 'users' as const, label: 'Users', region: 'r', zone: 'z' },
    {
      id: 'server',
      kind: 'server' as const,
      label: 'Server',
      capacity: n('server.small.capacity'),
      queueMax: n('server.queueMax'),
      baseLatencyMs: n('server.baseLatencyMs'),
      region: 'r',
      zone: 'z',
      up: true,
    },
  ],
  edges: [{ id: 'e', from: 'users', to: 'server' }],
  traffic: { users, requestsPerUserPerSec: n('traffic.requestsPerUserPerSec') },
  rules: {
    busyAt: n('rules.busyAt'),
    latencyCapAt: n('rules.latencyCapAt'),
    queueBadFraction: n('rules.queueBadFraction'),
    smoothingSeconds: n('rules.smoothingSeconds'),
  },
  seed: 1,
});

/** A repeatable stand-in for Math.random. */
function seeded(seed: number) {
  let value = seed;
  return () => {
    value = (value * 16807) % 2147483647;
    return value / 2147483647;
  };
}

function run(users: number, seconds: number) {
  let state: SimState = createState(world(users));
  let field: DotField = emptyField();
  const random = seeded(7);
  const seen = { answered: 0, dropped: 0 };
  for (let i = 0; i < seconds / 0.05; i++) {
    state = step(state, [], 0.05);
    field = updateDots(field, state, random);
    for (const dot of field.dots) if (dot.fate !== 'flowing') seen[dot.fate]++;
  }
  return { field, seen, state };
}

describe('dot sampler (a picture of the rates)', () => {
  it('draws more dots for more requests, but caps them', () => {
    expect(dotsPerSecond(10)).toBeLessThan(dotsPerSecond(100));
    expect(dotsPerSecond(1_000_000)).toBe(dotsPerSecond(10_000));
    expect(requestsPerDot(1000)).toBeGreaterThan(requestsPerDot(10));
  });

  it('a healthy server answers dots and drops none', () => {
    const { seen } = run(300, 10);
    expect(seen.answered).toBeGreaterThan(0);
    expect(seen.dropped).toBe(0);
  });

  it('a full waiting line turns dots away', () => {
    expect(run(5000, 15).seen.dropped).toBeGreaterThan(0);
  });

  it('keeps every live dot on the stage', () => {
    const { field } = run(5000, 15);
    for (const dot of field.dots) {
      expect(dot.x).toBeGreaterThanOrEqual(STAGE.usersRight);
      expect(dot.x).toBeLessThanOrEqual(STAGE.width + 10);
    }
  });

  it('clears when the sim resets (time jumps back)', () => {
    const { field } = run(1000, 5);
    expect(field.dots.length).toBeGreaterThan(0);
    const reset = updateDots(field, createState(world(1000)), Math.random);
    expect(reset.dots).toEqual([]);
  });

  it('does not move while the sim is paused (same time)', () => {
    const { field, state } = run(1000, 5);
    expect(updateDots(field, state, Math.random)).toBe(field);
  });
});
