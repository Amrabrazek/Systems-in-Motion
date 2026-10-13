import type { Health, NodeStatus, WorkNode } from '../../engine';

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

/** A box's look on the stage: its health, or down when it was killed. */
export type BoxLook = Health | 'down';

/** A killed box is drawn dashed and empty (design system part 1), with its own symbol and word. */
export const downLabel = { symbol: '✕', word: 'DOWN' } as const;

export function lookText(look: BoxLook): string {
  return look === 'down' ? `${downLabel.symbol} ${downLabel.word}` : healthText(look);
}

export const boxLook = (node: WorkNode, status: NodeStatus): BoxLook =>
  node.up ? status.health : 'down';
