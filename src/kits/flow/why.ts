import type { NodeStatus, WorkNode } from '../../engine';

/** A sentence split into plain and bold parts, so the UI can bold the key numbers. */
export type WhyPart = { text: string; bold?: boolean };

const percent = (utilization: number) => `${Math.round(utilization * 100)}% busy`;
const ms = (latencyMs: number) =>
  latencyMs >= 1000 ? `${(latencyMs / 1000).toFixed(1)} s` : `${Math.round(latencyMs)} ms`;
const perSecond = (rate: number) => `${Math.round(rate).toLocaleString('en-US')} requests/s`;

/**
 * The "why" line: one plain sentence naming the limit that was hit (design system part 4).
 * Order matters: the first matching case is the most urgent thing on screen.
 */
export function whyLine(node: WorkNode, status: NodeStatus): WhyPart[] {
  const name = `The ${node.label.toLowerCase()}`;
  const queueFull = status.queueLength >= node.queueMax.value - 1;

  if (!node.up) {
    return [
      { text: `${name} is ` },
      { text: 'down', bold: true },
      { text: '. Every request is turned away.' },
    ];
  }
  if (status.dropped > 0 || queueFull) {
    return [
      { text: `${name} is ` },
      { text: percent(status.utilization), bold: true },
      { text: ' and the waiting line is ' },
      { text: 'full', bold: true },
      { text: '. ' },
      { text: perSecond(status.dropped), bold: true },
      { text: ' are turned away.' },
    ];
  }
  if (status.utilization > 1) {
    return [
      { text: `${name} is ` },
      { text: percent(status.utilization), bold: true },
      { text: ': requests arrive faster than it can finish them, so the waiting line is ' },
      { text: 'growing', bold: true },
      { text: '.' },
    ];
  }
  if (status.queueLength > 0) {
    return [
      { text: 'The waiting line is ' },
      { text: 'draining', bold: true },
      { text: ` (${Math.round(status.queueLength)} waiting). Each request takes about ` },
      { text: ms(status.latencyMs), bold: true },
      { text: '.' },
    ];
  }
  if (status.health === 'warn') {
    return [
      { text: `${name} is ` },
      { text: percent(status.utilization), bold: true },
      { text: '. Requests start to wait their turn, so each takes about ' },
      { text: ms(status.latencyMs), bold: true },
      { text: '.' },
    ];
  }
  return [
    { text: `${name} is ` },
    { text: percent(status.utilization), bold: true },
    { text: '. Each request takes about ' },
    { text: ms(status.latencyMs), bold: true },
    { text: '.' },
  ];
}

export const whyText = (parts: WhyPart[]) => parts.map((part) => part.text).join('');
