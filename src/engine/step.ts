import { emptyTotals, smoothTotals } from './metrics';
import { createRng } from './rng';
import type {
  Action,
  Health,
  ModelRules,
  NodeStatus,
  SimState,
  Totals,
  WorkNode,
  World,
} from './types';

const MS_PER_SECOND = 1000;

const idleStatus: NodeStatus = {
  incoming: 0,
  served: 0,
  dropped: 0,
  queueLength: 0,
  utilization: 0,
  latencyMs: 0,
  health: 'ok',
};

export function createState(world: World): SimState {
  return {
    time: 0,
    world,
    rng: createRng(world.seed),
    nodes: Object.fromEntries(world.nodes.filter(isWorkNode).map((node) => [node.id, idleStatus])),
    edges: Object.fromEntries(world.edges.map((edge) => [edge.id, { rate: 0 }])),
    totals: emptyTotals,
    smoothed: emptyTotals,
  };
}

/** Advance the sim by `dt` seconds. Pure: same state + same actions ⇒ same result. */
export function step(state: SimState, actions: readonly Action[], dt: number): SimState {
  if (!(dt > 0)) throw new Error(`step needs dt > 0, got ${dt}`);

  const world = actions.reduce(applyAction, state.world);
  const arrivalRate = world.traffic.users * world.traffic.requestsPerUserPerSec.value;

  // M1 is one hop: users send to every box they have an edge to, split evenly. Multi-hop and
  // load balancers (only `up` targets) come later; see docs/engine.md "Later".
  const userIds = new Set(world.nodes.filter((node) => node.kind === 'users').map((n) => n.id));
  const outgoing = world.edges.filter((edge) => userIds.has(edge.from));
  const ratePerEdge = outgoing.length > 0 ? arrivalRate / outgoing.length : 0;

  const edges: SimState['edges'] = {};
  const incomingByNode = new Map<string, number>();
  for (const edge of world.edges) {
    const rate = userIds.has(edge.from) ? ratePerEdge : 0;
    edges[edge.id] = { rate };
    incomingByNode.set(edge.to, (incomingByNode.get(edge.to) ?? 0) + rate);
  }

  const nodes: SimState['nodes'] = {};
  for (const node of world.nodes.filter(isWorkNode)) {
    const previous = state.nodes[node.id] ?? idleStatus;
    nodes[node.id] = stepNode(node, previous, incomingByNode.get(node.id) ?? 0, world.rules, dt);
  }

  const totals = sumTotals(Object.values(nodes), arrivalRate);
  return {
    time: state.time + dt,
    world,
    rng: state.rng,
    nodes,
    edges,
    totals,
    smoothed: smoothTotals(state.smoothed, totals, dt, world.rules.smoothingSeconds.value),
  };
}

function applyAction(world: World, action: Action): World {
  switch (action.type) {
    case 'setUsers':
      return { ...world, traffic: { ...world.traffic, users: Math.max(0, action.users) } };
    case 'replaceWorld':
      // Nodes that keep their id keep their waiting line: a fix doesn't erase the backlog.
      return action.world;
  }
}

/** One box for one step: fill the line, serve what capacity allows, turn away overflow. */
export function stepNode(
  node: WorkNode,
  previous: NodeStatus,
  incoming: number,
  rules: ModelRules,
  dt: number,
): NodeStatus {
  if (!node.up) {
    return { ...idleStatus, incoming, dropped: incoming, health: 'bad' };
  }

  const capacity = node.capacity.value;
  const queueMax = node.queueMax.value;

  const work = previous.queueLength + incoming * dt;
  const servedThisStep = Math.min(capacity * dt, work);
  const waiting = work - servedThisStep;
  const overflow = Math.max(0, waiting - queueMax);
  const queueLength = waiting - overflow;

  const utilization = capacity > 0 ? incoming / capacity : 0;
  const busyPart = Math.min(utilization, rules.latencyCapAt.value);
  const waitInLineMs = capacity > 0 ? (queueLength / capacity) * MS_PER_SECOND : 0;
  const latencyMs = node.baseLatencyMs.value / (1 - busyPart) + waitInLineMs;

  return {
    incoming,
    served: servedThisStep / dt,
    dropped: overflow / dt,
    queueLength,
    utilization,
    latencyMs,
    health: healthOf(utilization, queueMax > 0 ? queueLength / queueMax : 0, rules),
  };
}

export function healthOf(utilization: number, queueFill: number, rules: ModelRules): Health {
  if (utilization > 1 || queueFill > rules.queueBadFraction.value) return 'bad';
  if (utilization < rules.busyAt.value) return 'ok';
  return 'warn';
}

function sumTotals(statuses: NodeStatus[], arrivalRate: number): Totals {
  const served = statuses.reduce((sum, status) => sum + status.served, 0);
  const dropped = statuses.reduce((sum, status) => sum + status.dropped, 0);
  const incoming = statuses.reduce((sum, status) => sum + status.incoming, 0);
  // Weighted by traffic, so an idle spare box doesn't make the average look better.
  const weightedLatency = statuses.reduce(
    (sum, status) => sum + status.latencyMs * status.incoming,
    0,
  );
  return {
    latencyMs: incoming > 0 ? weightedLatency / incoming : 0,
    errorRate: arrivalRate > 0 ? dropped / arrivalRate : 0,
    throughput: served,
  };
}

function isWorkNode(node: World['nodes'][number]): node is WorkNode {
  return node.kind !== 'users';
}
