import type { Health } from '../../engine';

/** Health is never color alone (design system rule 2): every state has a symbol and a word. */
export const healthLabels: Record<Health, { symbol: string; word: string }> = {
  ok: { symbol: '✓', word: 'HEALTHY' },
  warn: { symbol: '~', word: 'BUSY' },
  bad: { symbol: '!', word: 'OVERLOADED' },
};

export function healthText(health: Health): string {
  const { symbol, word } = healthLabels[health];
  return `${symbol} ${word}`;
}
