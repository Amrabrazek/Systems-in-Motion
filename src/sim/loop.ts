import { createState, step, type Action, type SimState, type World } from '../engine';
import type { FrameClock } from './clock';

/** Sim time per engine step. Fixed, so a run is the same at any frame rate (ADR 0005). */
export const STEP_SECONDS = 0.05;

/** React panels redraw at most this often; the stage redraws every frame. */
const SNAPSHOT_INTERVAL_MS = 100;

/**
 * Longest real gap one frame may cover. After a tab switch the browser can hand us seconds at
 * once; running all of it would freeze the page and then jump. We drop the excess instead.
 */
const MAX_FRAME_MS = 250;

const MS_PER_SECOND = 1000;

export interface SimSnapshot {
  state: SimState;
  paused: boolean;
  speed: number; // 1 = real time, 0.25 = slow-mo
}

export interface Sim {
  /** Latest state, for code that draws every frame (the stage). */
  getState(): SimState;
  /** Throttled, stable between publishes: safe for useSyncExternalStore. */
  getSnapshot(): SimSnapshot;
  subscribe(listener: () => void): () => void;
  /** Called every frame with the latest state, outside React. */
  onFrame(listener: (state: SimState) => void): () => void;
  /** Queued and applied at the start of the next step, never mid-step. */
  dispatch(action: Action): void;
  pause(): void;
  resume(): void;
  setSpeed(speed: number): void;
  /** Back to time 0 with the starting world (or a new one). Keeps paused and speed. */
  reset(world?: World): void;
  start(): void;
  stop(): void;
}

export function createSim(initialWorld: World, clock: FrameClock): Sim {
  let startWorld = initialWorld;
  let state = createState(startWorld);
  let queued: Action[] = [];
  let paused = false;
  let speed = 1;
  let accumulatorSeconds = 0;
  let lastFrameMs: number | undefined;
  let frameId: number | undefined;
  let lastPublishMs = Number.NEGATIVE_INFINITY;
  let snapshot: SimSnapshot = { state, paused, speed };

  const listeners = new Set<() => void>();
  const frameListeners = new Set<(state: SimState) => void>();

  function publish() {
    snapshot = { state, paused, speed };
    lastPublishMs = clock.now();
    for (const listener of listeners) listener();
  }

  function advance(realMs: number) {
    if (paused) return;
    accumulatorSeconds += (Math.min(realMs, MAX_FRAME_MS) / MS_PER_SECOND) * speed;
    while (accumulatorSeconds >= STEP_SECONDS) {
      const actions = queued;
      queued = [];
      state = step(state, actions, STEP_SECONDS);
      accumulatorSeconds -= STEP_SECONDS;
    }
  }

  function frame(nowMs: number) {
    advance(lastFrameMs === undefined ? 0 : nowMs - lastFrameMs);
    lastFrameMs = nowMs;
    for (const listener of frameListeners) listener(state);
    if (nowMs - lastPublishMs >= SNAPSHOT_INTERVAL_MS) publish();
    frameId = clock.requestFrame(frame);
  }

  return {
    getState: () => state,
    getSnapshot: () => snapshot,
    subscribe(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    onFrame(listener) {
      frameListeners.add(listener);
      return () => frameListeners.delete(listener);
    },
    dispatch(action) {
      queued.push(action);
    },
    pause() {
      paused = true;
      publish();
    },
    resume() {
      paused = false;
      publish();
    },
    setSpeed(next) {
      if (!(next > 0)) throw new Error(`speed must be > 0, got ${next}`);
      speed = next;
      publish();
    },
    reset(world) {
      if (world) startWorld = world;
      state = createState(startWorld);
      queued = [];
      accumulatorSeconds = 0;
      publish();
    },
    start() {
      if (frameId !== undefined) return;
      lastFrameMs = undefined;
      frameId = clock.requestFrame(frame);
    },
    stop() {
      if (frameId !== undefined) clock.cancelFrame(frameId);
      frameId = undefined;
    },
  };
}
