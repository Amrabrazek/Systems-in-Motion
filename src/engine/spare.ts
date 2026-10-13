import type { SpareLevel, WorkNode, World } from './types';

/**
 * "If one more server dies right now, do the rest hold?" Answered from capacity, not from
 * the error rate, so it reads the same during the health-check gap (ADR 0011) and doesn't
 * flicker. Only live servers count: one already dead means "lose one *more*".
 * The worst case is losing the biggest one, so that is the one we take away.
 */
export function survivesLosingOne(world: World): SpareLevel {
  const live = world.nodes.filter((node): node is WorkNode => node.kind === 'server' && node.up);
  const capacities = live.map((node) => node.capacity.value);
  const leftAfterLoss =
    capacities.reduce((sum, capacity) => sum + capacity, 0) - Math.max(0, ...capacities);
  // With nothing left after the loss there is no spare, even at zero users.
  if (leftAfterLoss <= 0) return 'no';

  const demand = world.traffic.users * world.traffic.requestsPerUserPerSec.value;
  const utilizationAfterLoss = demand / leftAfterLoss;
  if (utilizationAfterLoss < world.rules.busyAt.value) return 'yes';
  if (utilizationAfterLoss <= 1) return 'tight';
  return 'no';
}
