import { describe, expect, it } from 'vitest';
import type { SimState } from '../../engine';
import { addSample, emptyHistory, SAMPLE_SECONDS, WINDOW_SECONDS } from './history';

const at = (time: number, errorRate = 0): SimState =>
  ({ time, smoothed: { latencyMs: 50, errorRate, throughput: 0 } }) as SimState;

describe('chart history', () => {
  it('samples every quarter second of sim time, not every frame', () => {
    let history = emptyHistory();
    for (let time = 0.05; time <= 1.001; time += 0.05) history = addSample(history, at(time));
    expect(history.times).toHaveLength(Math.round(1 / SAMPLE_SECONDS));
  });

  it('keeps only the last 60 s', () => {
    let history = emptyHistory();
    for (let time = 0; time <= 120; time += SAMPLE_SECONDS) history = addSample(history, at(time));
    expect(history.times[0]).toBeGreaterThan(120 - WINDOW_SECONDS);
    expect(history.times.length).toBeLessThanOrEqual(WINDOW_SECONDS / SAMPLE_SECONDS);
  });

  it('stores errors as a percent', () => {
    expect(addSample(emptyHistory(), at(1, 0.2)).errorPercent).toEqual([20]);
  });

  it('starts over when sim time jumps back (reset)', () => {
    let history = emptyHistory();
    for (let time = 0; time <= 10; time += SAMPLE_SECONDS) history = addSample(history, at(time));
    expect(addSample(history, at(0.05)).times).toEqual([0.05]);
  });

  it('returns the same object when no sample is due', () => {
    const history = addSample(emptyHistory(), at(1));
    expect(addSample(history, at(1.1))).toBe(history);
  });
});
