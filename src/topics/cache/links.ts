import type { World } from '../../engine';
import type { StageHighlight } from '../../kits/flow/highlight';
import type { TradeoffLink } from '../../ui/shared/tradeoff';
import { cacheOf, databaseOf } from './world';

/** The fix (and its new risk) is the cache; what breaks next is the database behind it. */
export function idsForLink(world: World, link: TradeoffLink): Set<string> {
  const node = link === 'fix' ? cacheOf(world) : databaseOf(world);
  return new Set(node ? [node.id] : []);
}

/** Without a cache on the stage the fix rows have no box to light. */
export const availableLinks = (world: World): TradeoffLink[] =>
  cacheOf(world) ? ['fix', 'limit'] : ['limit'];

export function highlightFor(
  world: World,
  link: TradeoffLink | undefined,
): StageHighlight | undefined {
  return link ? { ids: idsForLink(world, link), tone: link } : undefined;
}

export function linkForNode(world: World, id: string): TradeoffLink | undefined {
  if (idsForLink(world, 'fix').has(id)) return 'fix';
  if (idsForLink(world, 'limit').has(id)) return 'limit';
  return undefined;
}
