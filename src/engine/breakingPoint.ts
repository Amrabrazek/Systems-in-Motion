import { createState, step } from './step';
import type { NodeStatus, SimState, World } from './types';

// Design's "find the breaking point" (docs/milestones/m4-design-v0.md, ADR 0015). Runs the same
// step() headless, many times, at steady load. No drawing, no clock: same world ⇒ same answer.

/** Each probe doubles the users until the design breaks: few runs to bracket the break. */
const GROWTH = 2;

/** All numbers come from the caller (ADR 0009); Design reads them from src/data/numbers. */
export interface BreakingPointOptions {
  startUsers: number; // first probe
  maxUsers: number; // stop searching here and report "holds"
  runSeconds: number; // sim time per probe, long enough for health checks and waiting lines
  precision: number; // stop when the gap between holds and breaks is this share of the users
  maxErrorRate: number; // 0..1, more than this turned away = broken
  maxLatencyMs: number; // slower than this on average = broken
  stepSeconds: number; // the sim's fixed step, so headless runs match the live page
}

/**
 * Why the design broke, most specific first:
 * - capacity: a box gets more than it can finish, so its line will overflow even if it hasn't yet
 * - errors: requests are already being turned away (a dead box, nowhere to send)
 * - latency: nothing is full, but the average answer is too slow
 */
export type BreakReason = 'capacity' | 'errors' | 'latency';

export type BreakingPoint =
  | {
      breaks: true;
      users: number; // fewest users found that break it
      lastHeld: number; // most users found that it holds
      firstNodeId: string | undefined; // the box that broke; undefined if no single box is to blame
      reason: BreakReason;
    }
  | { breaks: false; heldUpTo: number };

interface Probe {
  reason: BreakReason;
  nodeId: string | undefined;
}

/**
 * Find the fewest users that break `world`: double from `startUsers` until it breaks, then
 * binary search between the last users that held and the first that broke. The users in
 * `world` itself are ignored. Assumes more users never make a design healthier, which holds
 * for flow math (a cache's hit rate rises with users, but what it passes on still grows).
 */
export function findBreakingPoint(world: World, options: BreakingPointOptions): BreakingPoint {
  let held = 0;
  let broke: { users: number; probe: Probe } | undefined;

  for (let users = Math.max(1, Math.round(options.startUsers)); ; users *= GROWTH) {
    const capped = Math.min(users, options.maxUsers);
    const probe = probeAt(world, capped, options);
    if (probe) {
      broke = { users: capped, probe };
      break;
    }
    held = capped;
    if (capped >= options.maxUsers) return { breaks: false, heldUpTo: held };
  }

  while (broke.users - held > Math.max(1, held * options.precision)) {
    const middle = Math.floor((held + broke.users) / GROWTH);
    const probe = probeAt(world, middle, options);
    if (probe) broke = { users: middle, probe };
    else held = middle;
  }

  return {
    breaks: true,
    users: broke.users,
    lastHeld: held,
    firstNodeId: broke.probe.nodeId,
    reason: broke.probe.reason,
  };
}

/** One headless run at steady `users`. Returns why it broke, or undefined if it held. */
function probeAt(world: World, users: number, options: BreakingPointOptions): Probe | undefined {
  let state = warmCaches(createState({ ...world, traffic: { ...world.traffic, users } }));
  const steps = Math.ceil(options.runSeconds / options.stepSeconds);
  for (let index = 0; index < steps; index++) state = step(state, [], options.stepSeconds);
  return judge(state, options);
}

/**
 * The question is "does the design hold at steady load?", so caches start warm. A cold start
 * is its own risk (ADR 0014) and would make the answer depend on how long the probe runs.
 */
function warmCaches(state: SimState): SimState {
  const cacheView = Object.fromEntries(
    Object.entries(state.cacheView).map(([id, view]) => [id, { ...view, warmth: 1 }]),
  );
  return { ...state, cacheView };
}

function judge(state: SimState, options: BreakingPointOptions): Probe | undefined {
  const statuses = Object.entries(state.nodes);
  const overloaded = statuses.filter(([, status]) => status.utilization > 1);
  if (overloaded.length > 0)
    return { reason: 'capacity', nodeId: worst(overloaded, 'utilization') };
  if (state.totals.errorRate > options.maxErrorRate)
    return { reason: 'errors', nodeId: worst(statuses, 'dropped') };
  if (state.totals.latencyMs > options.maxLatencyMs)
    return { reason: 'latency', nodeId: worst(statuses, 'latencyMs') };
  return undefined;
}

function worst(
  statuses: readonly (readonly [string, NodeStatus])[],
  key: 'utilization' | 'dropped' | 'latencyMs',
): string | undefined {
  let best: readonly [string, NodeStatus] | undefined;
  for (const entry of statuses) if (!best || entry[1][key] > best[1][key]) best = entry;
  return best && best[1][key] > 0 ? best[0] : undefined;
}
