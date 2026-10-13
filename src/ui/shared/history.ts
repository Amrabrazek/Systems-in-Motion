import type { SimState } from '../../engine';

/** A rolling window of smoothed totals, sampled on sim time so pause and slow-mo stay honest. */
export interface History {
  times: number[]; // seconds of sim time
  latencyMs: number[];
  errorPercent: number[];
}

export const SAMPLE_SECONDS = 0.25;
export const WINDOW_SECONDS = 60;
const PERCENT = 100;

export function emptyHistory(): History {
  return { times: [], latencyMs: [], errorPercent: [] };
}

/** Returns the same object when no new sample is due, so callers can skip redraws. */
export function addSample(history: History, state: SimState): History {
  const last = history.times.at(-1);
  if (last !== undefined && state.time < last) return addSample(emptyHistory(), state); // reset
  if (last !== undefined && state.time - last < SAMPLE_SECONDS - 1e-9) return history;

  const keepFrom = history.times.findIndex((time) => time > state.time - WINDOW_SECONDS);
  const start = keepFrom === -1 ? history.times.length : keepFrom;
  return {
    times: [...history.times.slice(start), state.time],
    latencyMs: [...history.latencyMs.slice(start), state.smoothed.latencyMs],
    errorPercent: [...history.errorPercent.slice(start), state.smoothed.errorRate * PERCENT],
  };
}
