import { edgesByFrom } from './graph';
import type { LoadBalancerNode, SimEdge, SimNode, SimState, TargetView, World } from './types';

/**
 * Whether a box is really able to take traffic right now. A dead cache still counts: it
 * passes every request on to the box behind it (ADR 0014).
 */
export function isReallyUp(node: SimNode | undefined): boolean {
  return (node?.kind !== 'server' && node?.kind !== 'database') || node.up;
}

export function isLoadBalancer(node: SimNode): node is LoadBalancerNode {
  return node.kind === 'loadBalancer';
}

/**
 * Each load balancer's belief about its targets, advanced by `dt`. A belief flips only after
 * reality has looked different for `healthCheckSeconds` without a break, so a box revived
 * inside the window is never marked down (real LBs need several failed checks in a row).
 * Targets the LB hasn't seen before join with their real state: adding a server should help
 * right away in a lesson, even though real LBs health-check a new target first.
 */
export function updateLbView(
  world: World,
  previous: SimState['lbView'],
  dt: number,
): SimState['lbView'] {
  const byId = new Map(world.nodes.map((node) => [node.id, node]));
  const outgoing = edgesByFrom(world.edges);
  const view: SimState['lbView'] = {};

  for (const lb of world.nodes.filter(isLoadBalancer)) {
    const beliefs: Record<string, TargetView> = {};
    for (const edge of outgoing.get(lb.id) ?? []) {
      const up = isReallyUp(byId.get(edge.to));
      const before = previous[lb.id]?.[edge.to];
      beliefs[edge.to] = nextBelief(before, up, dt, lb.healthCheckSeconds.value);
    }
    view[lb.id] = beliefs;
  }
  return view;
}

function nextBelief(
  before: TargetView | undefined,
  up: boolean,
  dt: number,
  healthCheckSeconds: number,
): TargetView {
  if (!before || before.seenUp === up) return { seenUp: up, mismatchSeconds: 0 };
  const mismatchSeconds = before.mismatchSeconds + dt;
  if (mismatchSeconds >= healthCheckSeconds) return { seenUp: up, mismatchSeconds: 0 };
  return { seenUp: before.seenUp, mismatchSeconds };
}

/**
 * The edges a load balancer sends on: the targets it believes are up. When it believes none
 * are, it fails open and uses them all, as AWS ALB does; the requests still fail at the
 * dead boxes, so errors show 100% either way.
 */
export function edgesInUse(
  out: readonly SimEdge[],
  beliefs: Record<string, TargetView> | undefined,
): readonly SimEdge[] {
  const believedUp = out.filter((edge) => beliefs?.[edge.to]?.seenUp ?? true);
  return believedUp.length > 0 ? believedUp : out;
}
