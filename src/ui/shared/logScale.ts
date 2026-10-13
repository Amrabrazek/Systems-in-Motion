/**
 * Log-scale slider (M1 plan, "Slider feel"): 10 → 10,000 users on a linear slider would spend
 * the first half where nothing happens. On a log scale each quarter is ~5.6× more users.
 */
export interface LogScale {
  min: number;
  max: number;
  steps: number; // slider positions, 0..steps
}

export function positionToValue({ min, max, steps }: LogScale, position: number): number {
  const fraction = Math.min(Math.max(position / steps, 0), 1);
  return roundNicely(min * (max / min) ** fraction);
}

export function valueToPosition({ min, max, steps }: LogScale, value: number): number {
  const clamped = Math.min(Math.max(value, min), max);
  return Math.round((Math.log(clamped / min) / Math.log(max / min)) * steps);
}

/** 1,234 → 1,200: users read the slider as rough amounts, not exact counts. */
export function roundNicely(value: number): number {
  if (value < 100) return Math.round(value);
  const magnitude = 10 ** (Math.floor(Math.log10(value)) - 1);
  return Math.round(value / magnitude) * magnitude;
}

/** The users slider on every Flow page: 10 → 10,000. */
export const usersScale: LogScale = { min: 10, max: 10_000, steps: 300 };
