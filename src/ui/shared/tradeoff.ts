/** Cost is relative only (CLAUDE.md "Content rules"): no prices, ever. */
export type Cost = 'cheap' | 'medium' | 'expensive';

/**
 * Every fix pays for itself somewhere. The card says where, always in the same five rows.
 * Plain strings on purpose: levels stay pure data (share links, Design mode), and the
 * numbers stay on the stage where they carry their M / R / T / U tag.
 */
export interface TradeoffCard {
  fixes: string;
  /** One level, or a move between two ("cheap → medium"). */
  cost: Cost | { from: Cost; to: Cost };
  complexity: string;
  newRisk: string;
  breaksNext: string;
}

/** The row order is part of the design: readers learn where to look once. */
export const tradeoffRows: readonly { key: keyof TradeoffCard; label: string }[] = [
  { key: 'fixes', label: 'Fixes' },
  { key: 'cost', label: 'Cost' },
  { key: 'complexity', label: 'Complexity' },
  { key: 'newRisk', label: 'New risk' },
  { key: 'breaksNext', label: 'Breaks next' },
];

export function costText(cost: TradeoffCard['cost']): string {
  if (typeof cost === 'string') return cost;
  return cost.from === cost.to ? cost.from : `${cost.from} → ${cost.to}`;
}

export function rowText(card: TradeoffCard, key: keyof TradeoffCard): string {
  const value = card[key];
  return typeof value === 'string' ? value : costText(value);
}
