import type { Totals } from './types';

/**
 * Exponential moving average that behaves the same at any step size: after `timeConstant`
 * seconds the smoothed value has covered ~63% of the gap to the raw value.
 */
export function smooth(previous: number, raw: number, dt: number, timeConstant: number): number {
  if (timeConstant <= 0) return raw;
  const blend = 1 - Math.exp(-dt / timeConstant);
  return previous + (raw - previous) * blend;
}

export function smoothTotals(
  previous: Totals,
  raw: Totals,
  dt: number,
  timeConstant: number,
): Totals {
  return {
    latencyMs: smooth(previous.latencyMs, raw.latencyMs, dt, timeConstant),
    errorRate: smooth(previous.errorRate, raw.errorRate, dt, timeConstant),
    throughput: smooth(previous.throughput, raw.throughput, dt, timeConstant),
  };
}

export const emptyTotals: Totals = { latencyMs: 0, errorRate: 0, throughput: 0 };
