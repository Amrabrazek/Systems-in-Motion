import type { World } from '../../engine';
import type { StageHighlight } from '../../kits/flow/highlight';
import type { TradeoffLink } from '../../ui/shared/tradeoff';
import { serversOf } from './world';

/**
 * Which boxes each tradeoff row is about. The fix is "load balancer + second server", so it
 * lights the load balancer and the second server only (with one server left, just the balancer).
 * What breaks next is the N+1 spare, so it lights every server.
 */
export function idsForLink(world: World, link: TradeoffLink): Set<string> {
  const servers = serversOf(world);
  if (link === 'limit') return new Set(servers.map((node) => node.id));
  const balancer = world.nodes.find((node) => node.kind === 'loadBalancer');
  const second = servers[1];
  return new Set([balancer?.id, second?.id].filter((id): id is string => id !== undefined));
}

export function highlightFor(
  world: World,
  link: TradeoffLink | undefined,
): StageHighlight | undefined {
  return link ? { ids: idsForLink(world, link), tone: link } : undefined;
}

/** Pointing at a box lights its rows. A server is about the spare, so "limit" wins for it. */
export function linkForNode(world: World, id: string): TradeoffLink | undefined {
  if (idsForLink(world, 'limit').has(id)) return 'limit';
  if (idsForLink(world, 'fix').has(id)) return 'fix';
  return undefined;
}
