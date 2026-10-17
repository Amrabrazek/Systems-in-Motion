/**
 * Lighting boxes on the Flow stage from outside it (a tradeoff row, a lesson step).
 * Generic on purpose: the kit only knows node ids and a tone, never why they are lit.
 */
export type HighlightTone = 'fix' | 'limit';

export interface StageHighlight {
  ids: ReadonlySet<string>;
  /** fix = accent (what was added), limit = bad (what breaks next). Same as the tradeoff marks. */
  tone: HighlightTone;
}

/** Touch has no hover, so a tap toggles: tapping a lit box clears, any other box points at it. */
export function pointAfterTap(
  id: string,
  highlight: StageHighlight | undefined,
): string | undefined {
  return highlight?.ids.has(id) ? undefined : id;
}
