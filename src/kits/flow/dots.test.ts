import { describe, expect, it } from 'vitest';
import { createState, step, type Action, type SimState, type World } from '../../engine';
import { dotsPerSecond, emptyField, requestsPerDot, updateDots, type DotField } from './dots';
import { stageLayout } from './layout';
import { STAGE } from './stageMath';
import { balanced, oneServer } from './worlds.fixture';

/** A repeatable stand-in for Math.random (mulberry32: even enough for split counts). */
function seeded(seed: number) {
  let value = seed;
  return () => {
    value = (value + 0x6d2b79f5) | 0;
    let mixed = Math.imul(value ^ (value >>> 15), 1 | value);
    mixed = (mixed + Math.imul(mixed ^ (mixed >>> 7), 61 | mixed)) ^ mixed;
    return ((mixed ^ (mixed >>> 14)) >>> 0) / 4294967296;
  };
}

interface Seen {
  answered: number;
  dropped: number;
  queuedAt: Record<string, number>; // dots that reached each server's waiting line
  droppedAt: Record<string, number>;
}

function run(world: World, seconds: number, actionsAt: Record<number, Action[]> = {}) {
  let state: SimState = createState(world);
  let field: DotField = emptyField();
  const random = seeded(7);
  const seen: Seen = { answered: 0, dropped: 0, queuedAt: {}, droppedAt: {} };
  const counted = new Set<string>();
  for (let i = 0; i < seconds / 0.05; i++) {
    state = step(state, actionsAt[i] ?? [], 0.05);
    field = updateDots(field, state, random);
    for (const dot of field.dots) {
      // Count each dot once per thing that happened to it.
      const key = `${dot.id}:${dot.fate}:${dot.leg}:${dot.at}`;
      if (counted.has(key)) continue;
      counted.add(key);
      if (dot.fate === 'answered') seen.answered++;
      if (dot.fate === 'dropped') {
        seen.dropped++;
        seen.droppedAt[dot.at] = (seen.droppedAt[dot.at] ?? 0) + 1;
      } else if (dot.leg === 'queue') {
        seen.queuedAt[dot.at] = (seen.queuedAt[dot.at] ?? 0) + 1;
      }
    }
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
    const { seen } = run(oneServer(300), 10);
    expect(seen.answered).toBeGreaterThan(0);
    expect(seen.dropped).toBe(0);
  });

  it('a full waiting line turns dots away', () => {
    expect(run(oneServer(5000), 15).seen.dropped).toBeGreaterThan(0);
  });

  it('keeps every live dot on the stage', () => {
    for (const world of [oneServer(5000), balanced(4, 5000)]) {
      const { field } = run(world, 15);
      const { width } = stageLayout(world);
      for (const dot of field.dots) {
        expect(dot.x).toBeGreaterThanOrEqual(STAGE.usersRight);
        expect(dot.x).toBeLessThanOrEqual(width + 10);
      }
    }
  });

  it('clears when the sim resets (time jumps back)', () => {
    const { field } = run(oneServer(1000), 5);
    expect(field.dots.length).toBeGreaterThan(0);
    const reset = updateDots(field, createState(oneServer(1000)), Math.random);
    expect(reset.dots).toEqual([]);
  });

  it('does not move while the sim is paused (same time)', () => {
    const { field, state } = run(oneServer(1000), 5);
    expect(updateDots(field, state, Math.random)).toBe(field);
  });
});

describe('dots across a load balancer', () => {
  it('split at the LB roughly evenly across healthy servers, and get answered', () => {
    const { seen } = run(balanced(2, 600), 20);
    const a = seen.queuedAt.a ?? 0;
    const b = seen.queuedAt.b ?? 0;
    expect(a + b).toBeGreaterThan(100);
    expect(Math.abs(a - b) / (a + b)).toBeLessThan(0.2);
    expect(seen.answered).toBeGreaterThan(100);
    expect(seen.dropped).toBe(0);
  });

  it('still go to a killed server until the LB notices, and turn red there', () => {
    // Kill B at 5 s; the LB's health-check window is a few seconds.
    const { seen } = run(balanced(2, 600), 7, { 100: [{ type: 'killNode', nodeId: 'b' }] });
    expect(seen.droppedAt.b ?? 0).toBeGreaterThan(5);
    expect(seen.droppedAt.a ?? 0).toBe(0);
  });

  it('stop going to a killed server once the LB has noticed', () => {
    const kill = { 0: [{ type: 'killNode' as const, nodeId: 'b' }] };
    const late = run(balanced(2, 600), 30, kill);
    const early = run(balanced(2, 600), 8, kill);
    // Every dot dropped at B was dropped early: nothing more after the window.
    expect(late.seen.droppedAt.b).toBe(early.seen.droppedAt.b);
    expect(late.seen.queuedAt.b ?? 0).toBe(0);
  });

  it('dots already waiting in a killed server are turned away, not answered', () => {
    const { field, state } = run(balanced(2, 1500), 10);
    const waiting = field.dots.filter((dot) => dot.at === 'b' && dot.leg === 'queue');
    expect(waiting.length).toBeGreaterThan(0);
    const killed = step(state, [{ type: 'killNode', nodeId: 'b' }], 0.05);
    const next = updateDots(field, killed, seeded(3));
    for (const dot of waiting) {
      expect(next.dots.find((after) => after.id === dot.id)?.fate).toBe('dropped');
    }
  });

  it('never exceeds one shared dot budget, even with 4 servers', () => {
    const { field } = run(balanced(4, 10_000), 20);
    expect(field.dots.length).toBeLessThanOrEqual(220);
  });

  it('drops dots that were on an edge that no longer exists', () => {
    const { field, state } = run(balanced(3, 600), 5);
    const smaller = step(state, [{ type: 'replaceWorld', world: balanced(1, 600) }], 0.05);
    const next = updateDots(field, smaller, seeded(3));
    for (const dot of next.dots) {
      if (dot.fate === 'dropped') continue;
      expect(['users-lb', 'lb', 'lb-a', 'a']).toContain(dot.at);
    }
  });
});
