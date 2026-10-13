/** Round a chart's top up to a readable value, so the axis doesn't jitter every sample. */
export function niceMax(value: number, steps: readonly number[]): number {
  return steps.find((step) => value <= step) ?? steps.at(-1) ?? value;
}

/** '#2f5bd3' + 0.12 → 'rgba(47, 91, 211, 0.12)'. Token values are hex; anything else passes through. */
export function withAlpha(color: string, alpha: number): string {
  const match = /^#([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i.exec(color);
  if (!match) return color;
  const [red, green, blue] = match.slice(1).map((part) => parseInt(part, 16));
  return `rgba(${red}, ${green}, ${blue}, ${alpha})`;
}
