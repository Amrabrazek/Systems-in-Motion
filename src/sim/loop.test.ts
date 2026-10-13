import { describe, expect, it } from 'vitest';
import { getNumber } from '../data/numbers';
import { createState, step, type SimState, type World } from '../engine';
import type { FrameClock } from './clock';
import { createSim, STEP_SECONDS } from './loop';

const n = (id: string) => getNumber('teaching', id);

function world(users: number): World {
  return {
    nodes: [
      { id: 'users', kind: 'users', label: 'Users', region: 'region-1', zone: 'zone-a' },
      {
        id: 'server',
        kind: 'server',
        label: 'Server',
        capacity: n('server.small.capacity'),
        queueMax: n('server.queueMax'),
        baseLatencyMs: n('server.baseLatencyMs'),
        region: 'region-1',
        zone: 'zone-a',
        up: true,
      },
    ],
    edges: [{ id: 'users-server', from: 'users', to: 'server' }],
    traffic: { users, requestsPerUserPerSec: n('traffic.requestsPerUserPerSec') },
    rules: {
      busyAt: n('rules.busyAt'),
      latencyCapAt: n('rules.latencyCapAt'),
      queueBadFraction: n('rules.queueBadFraction'),
      smoothingSeconds: n('rules.smoothingSeconds'),
    },
    seed: 1,
  };
}

/** A clock that only moves when the test says so. */
function fakeClock() {
  let nowMs = 0;
  let pending: ((nowMs: number) => void) | undefined;
  const clock: FrameClock = {
    now: () => nowMs,
    requestFrame(callback) {
      pending = callback;
      return 1;
    },
    cancelFrame() {
      pending = undefined;
    },
  };
  /** Run frames `frameMs` apart until `totalMs` of real time has passed. */
  function runFrames(frameMs: number, totalMs: number) {
    for (let elapsed = 0; elapsed < totalMs; elapsed += frameMs) {
      nowMs += frameMs;
      const callback = pending;
      pending = undefined;
      callback?.(nowMs);
    }
  }
  return { clock, runFrames, hasPendingFrame: () => pending !== undefined };
}

function startedSim(users: number) {
  const fake = fakeClock();
  const sim = createSim(world(users), fake.clock);
  sim.start();
  return { sim, ...fake };
}

function runEngine(start: SimState, steps: number): SimState {
  let state = start;
  for (let i = 0; i < steps; i++) state = step(state, [], STEP_SECONDS);
  return state;
}

describe('sim loop (ADR 0005)', () => {
  it('runs 1 s of sim time per 1 s of real time at speed 1', () => {
    const { sim, runFrames } = startedSim(500);
    runFrames(16, 1000 + 16); // the first frame only sets the start time
    expect(sim.getState().time).toBeCloseTo(1, 1);
  });

  it('gives the same state whatever the frame rate', () => {
    const at60 = startedSim(2000);
    const at20 = startedSim(2000);
    at60.runFrames(1000 / 60, 3000);
    at20.runFrames(50, 3000);
    const steps = Math.round(at20.sim.getState().time / STEP_SECONDS);
    expect(Math.round(at60.sim.getState().time / STEP_SECONDS)).toBe(steps);
    expect(at60.sim.getState()).toEqual(at20.sim.getState());
    expect(at20.sim.getState()).toEqual(runEngine(createState(world(2000)), steps));
  });

  it('slow-mo runs fewer steps, 10× runs more, and both match the engine step for step', () => {
    const slow = startedSim(2000);
    slow.sim.setSpeed(0.25);
    slow.runFrames(50, 4050);
    expect(slow.sim.getState().time).toBeCloseTo(1, 5);

    const fast = startedSim(2000);
    fast.sim.setSpeed(10);
    fast.runFrames(50, 1050);
    expect(fast.sim.getState().time).toBeCloseTo(10, 5);
    expect(fast.sim.getState()).toEqual(runEngine(createState(world(2000)), 200));
  });

  it('pause freezes sim time; resume carries on without a jump', () => {
    const { sim, runFrames } = startedSim(500);
    runFrames(50, 1050);
    sim.pause();
    const frozen = sim.getState();
    runFrames(50, 5000);
    expect(sim.getState()).toBe(frozen);
    sim.resume();
    runFrames(50, 500);
    expect(sim.getState().time).toBeCloseTo(frozen.time + 0.5, 5);
  });

  it('applies a dispatched action at the next step', () => {
    const { sim, runFrames } = startedSim(100);
    runFrames(50, 550);
    sim.dispatch({ type: 'setUsers', users: 3000 });
    expect(sim.getState().world.traffic.users).toBe(100);
    runFrames(50, 50);
    expect(sim.getState().world.traffic.users).toBe(3000);
  });

  it('reset goes back to time 0 with the starting world and drops queued actions', () => {
    const { sim, runFrames } = startedSim(100);
    runFrames(50, 1050);
    sim.dispatch({ type: 'setUsers', users: 3000 });
    sim.reset();
    runFrames(50, 50);
    expect(sim.getState().time).toBeCloseTo(STEP_SECONDS, 9);
    expect(sim.getState().world.traffic.users).toBe(100);
  });

  it('reset can swap in a new starting world', () => {
    const { sim } = startedSim(100);
    sim.reset(world(42));
    expect(sim.getState().world.traffic.users).toBe(42);
    expect(sim.getState().time).toBe(0);
  });

  it('a long gap (tab switch) is capped instead of replayed', () => {
    const { sim, runFrames } = startedSim(500);
    runFrames(50, 50);
    runFrames(60_000, 60_000);
    expect(sim.getState().time).toBeLessThan(1);
  });

  it('publishes snapshots ~10×/s, not every frame, and keeps them stable in between', () => {
    const { sim, runFrames } = startedSim(500);
    let publishes = 0;
    sim.subscribe(() => publishes++);
    runFrames(1000 / 60, 2000);
    expect(publishes).toBeGreaterThanOrEqual(15);
    expect(publishes).toBeLessThanOrEqual(21);
    expect(sim.getSnapshot()).toBe(sim.getSnapshot());
  });

  it('calls frame listeners every frame with the latest state', () => {
    const { sim, runFrames } = startedSim(500);
    const seen: number[] = [];
    sim.onFrame((state) => seen.push(state.time));
    runFrames(50, 500);
    expect(seen).toHaveLength(10);
    expect(seen.at(-1)).toBe(sim.getState().time);
  });

  it('pause, resume and speed changes publish right away', () => {
    const { sim } = startedSim(500);
    sim.pause();
    expect(sim.getSnapshot().paused).toBe(true);
    sim.setSpeed(0.25);
    expect(sim.getSnapshot().speed).toBe(0.25);
    expect(() => sim.setSpeed(0)).toThrow();
  });

  it('stop cancels the next frame', () => {
    const { sim, hasPendingFrame } = startedSim(500);
    sim.stop();
    expect(hasPendingFrame()).toBe(false);
  });
});
