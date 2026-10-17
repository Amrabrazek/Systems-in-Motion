import type { CacheNode, NodeStatus, SimState, WorkNode } from '../../engine';
import { cacheLook, type BoxLook } from './health';

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
export function whyLine(
  node: WorkNode,
  status: NodeStatus,
  name = `The ${node.label.toLowerCase()}`,
): WhyPart[] {
  const queueFull = isQueueFull(node, status);

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

const isQueueFull = (node: WorkNode, status: NodeStatus) =>
  status.queueLength >= node.queueMax.value - 1;

export interface Why {
  look: BoxLook; // drives the pill beside the sentence
  parts: WhyPart[];
}

/**
 * The "why" line for a whole stage: finds the most urgent box (servers, and a database behind
 * them) and talks about it. A dead server comes first, because it explains what the survivors
 * are going through. A cache in front of the database says first what it is doing, because that
 * explains the database's load (ADR 0014).
 */
export function whyForState(state: SimState): Why | undefined {
  const servers = state.world.nodes.filter((node): node is WorkNode => node.kind === 'server');
  const databases = state.world.nodes.filter((node): node is WorkNode => node.kind === 'database');
  const single = servers.length === 1;
  const nameOf = (node: WorkNode) =>
    single || node.kind === 'database' ? `The ${node.label.toLowerCase()}` : node.label;
  const live = servers.filter((node) => node.up);
  const down = servers.filter((node) => !node.up);

  if (servers.length === 0) return undefined;
  if (live.length === 0) {
    const only = servers[0];
    const status = only && state.nodes[only.id];
    if (single && only && status) return { look: 'down', parts: whyLine(only, status) };
    return {
      look: 'down',
      parts: [
        { text: 'Every server is ' },
        { text: 'down', bold: true },
        { text: '. Every request is turned away.' },
      ],
    };
  }

  const unnoticed = down.map((node) => ({ node, share: lbShareTo(state, node.id) }));
  const stillSent = unnoticed.find(({ share }) => share > 0);
  if (stillSent) {
    return {
      look: 'down',
      parts: [
        { text: `${nameOf(stillSent.node)} is ` },
        { text: 'down', bold: true },
        { text: ". The load balancer hasn't noticed yet, so " },
        { text: `1 in ${Math.round(1 / stillSent.share)}`, bold: true },
        { text: ' requests still go there and are turned away.' },
      ],
    };
  }

  const worst = mostUrgent([...live, ...databases], state);
  const worstStatus = worst && state.nodes[worst.id];
  if (!worst || !worstStatus) return undefined;
  const sentence = [
    ...cacheSaying(state, worstStatus),
    ...whyLine(worst, worstStatus, nameOf(worst)),
  ];
  if (down.length === 0) {
    const cacheDown = cachesOf(state).some((node) => !node.up);
    const look = cacheDown && worstStatus.health !== 'bad' ? 'down' : worstStatus.health;
    return { look, parts: sentence };
  }

  const names = down.map(nameOf).join(' and ');
  return {
    look: worstStatus.health === 'bad' ? 'bad' : 'down',
    parts: [
      { text: `${names} ${down.length > 1 ? 'are' : 'is'} ` },
      { text: 'down', bold: true },
      { text: '. ' },
      ...sentence,
    ],
  };
}

const cachesOf = (state: SimState) =>
  state.world.nodes.filter((node): node is CacheNode => node.kind === 'cache');

/**
 * What the cache is doing, as the start of the why line: down (everything goes to the
 * database), warming up (most still does), or how much it answers. Empty with no cache.
 */
function cacheSaying(state: SimState, worstStatus: NodeStatus): WhyPart[] {
  const cache = cachesOf(state)[0];
  if (!cache) return [];
  const name = `The ${cache.label.toLowerCase()}`;
  const view = state.cacheView[cache.id];
  const share = `${Math.round((view?.hitRate ?? 0) * 100)}%`;
  const look = cacheLook(cache, view);
  if (look === 'down') {
    return [
      { text: `${name} is ` },
      { text: 'down', bold: true },
      { text: ', so every request goes on to the database. ' },
    ];
  }
  if (look === 'warn' && worstStatus.health !== 'ok') {
    return [
      { text: `${name} is ` },
      { text: 'warming up', bold: true },
      { text: ' and answers only ' },
      { text: share, bold: true },
      { text: ' from memory, so most requests still reach the database. ' },
    ];
  }
  return [{ text: `${name} answers ` }, { text: share, bold: true }, { text: ' from memory. ' }];
}

/** Share of a load balancer's traffic that goes to this box: > 0 means it still believes in it. */
function lbShareTo(state: SimState, nodeId: string): number {
  const { world } = state;
  for (const edge of world.edges) {
    if (edge.to !== nodeId) continue;
    const sender = world.nodes.find((node) => node.id === edge.from);
    const incoming = state.nodes[edge.from]?.incoming ?? 0;
    const rate = state.edges[edge.id]?.rate ?? 0;
    if (sender?.kind === 'loadBalancer' && incoming > 0 && rate > 0) return rate / incoming;
  }
  return 0;
}

/** Same order as whyLine's cases; ties go to the busier box. */
function urgency(node: WorkNode, status: NodeStatus): number {
  if (status.dropped > 0 || isQueueFull(node, status)) return 5;
  if (status.utilization > 1) return 4;
  if (status.queueLength > 0) return 3;
  return status.health === 'warn' ? 2 : 1;
}

function mostUrgent(nodes: WorkNode[], state: SimState): WorkNode | undefined {
  let best: { node: WorkNode; score: number; utilization: number } | undefined;
  for (const node of nodes) {
    const status = state.nodes[node.id];
    if (!status) continue;
    const score = urgency(node, status);
    if (
      !best ||
      score > best.score ||
      (score === best.score && status.utilization > best.utilization)
    ) {
      best = { node, score, utilization: status.utilization };
    }
  }
  return best?.node;
}

export const whyText = (parts: WhyPart[]) => parts.map((part) => part.text).join('');
