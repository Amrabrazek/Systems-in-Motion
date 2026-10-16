/** Keep a step index inside 0..count-1, so Back on the first step and Next on the last do nothing. */
export function moveStep(index: number, delta: number, count: number): number {
  if (count <= 0) return 0;
  return Math.min(count - 1, Math.max(0, index + delta));
}

/** Arrow keys move the stepper; Home/End jump to the ends. Other keys are left alone. */
export function stepForKey(key: string, index: number, count: number): number | undefined {
  switch (key) {
    case 'ArrowRight':
      return moveStep(index, 1, count);
    case 'ArrowLeft':
      return moveStep(index, -1, count);
    case 'Home':
      return 0;
    case 'End':
      return moveStep(count - 1, 0, count);
    default:
      return undefined;
  }
}
