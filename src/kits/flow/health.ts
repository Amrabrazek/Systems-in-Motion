import type { CacheNode, CacheView, Health, NodeStatus, WorkNode } from '../../engine';

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

/** Share of keys fetched since a (re)start from which a cache counts as warm. Picture only. */
export const WARM_FROM = 0.9;

/**
 * A cache is never busy (ADR 0014), so its look says how full it is instead: warm, still
 * warming up after a (re)start, or down. Same symbols as health, its own words.
 */
export type CacheLook = Exclude<BoxLook, 'bad'>;

export const cacheLook = (node: CacheNode, view: CacheView | undefined): CacheLook => {
  if (!node.up) return 'down';
  return (view?.warmth ?? 0) >= WARM_FROM ? 'ok' : 'warn';
};

export const cacheWords: Record<CacheLook, string> = {
  ok: `${healthLabels.ok.symbol} WARM`,
  warn: `${healthLabels.warn.symbol} WARMING UP`,
  down: `${downLabel.symbol} ${downLabel.word}`,
};
