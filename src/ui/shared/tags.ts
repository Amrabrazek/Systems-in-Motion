import type { NumberEntry, Tag } from '../../engine';

export const tagNames: Record<Tag, string> = {
  M: 'Measured',
  R: 'Rule of thumb',
  T: 'Teaching guess',
  U: 'Your own number',
};

/** Hover text: what kind of number, what it assumes, and where it came from (ADR 0009). */
export function tagTooltip(entry: NumberEntry): string {
  const lines = [`${tagNames[entry.tag]}: ${entry.note}`];
  if (entry.range) lines.push(`Usual range: ${entry.range[0]}–${entry.range[1]} ${entry.unit}`);
  if (entry.source) lines.push(`Source: ${entry.source.title} (${entry.source.url})`);
  return lines.join('\n');
}
