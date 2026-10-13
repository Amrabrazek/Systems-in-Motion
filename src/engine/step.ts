import { edgesByFrom, flowOrder } from './graph';
import { emptyTotals, smoothTotals } from './metrics';
import { createRng } from './rng';
import type {
  Action,
  Health,
  ModelRules,
  NodeStatus,
  SimEdge,
  SimState,
  Totals,
  WorkNode,
  World,
} from './types';

const MS_PER_SECOND = 1000;

interface Graph {
  order: string[];
  outgoing: Map<string, SimEdge[]>;
}

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
  flowOrder(world); // fail on a broken graph here, not on the first step
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
  // One graph walk order per step; worlds are small, and Design reruns this many times.
  const graph: Graph = { order: flowOrder(world), outgoing: edgesByFrom(world.edges) };
  const { nodes, edges } = flowThrough(world, graph, state.nodes, arrivalRate, dt);

  const totals = sumTotals(world, graph, nodes, edges, arrivalRate);
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

/**
 * Walk the graph in flow order: what a box serves this step is what its outgoing edges carry,
 * split evenly. Users split the arrival rate evenly across all their edges. Load balancers
 * (only `up` targets) come in M2 step 2; see docs/engine.md.
 */
function flowThrough(
  world: World,
  { order, outgoing }: Graph,
  previousNodes: SimState['nodes'],
  arrivalRate: number,
  dt: number,
): Pick<SimState, 'nodes' | 'edges'> {
  const byId = new Map(world.nodes.map((node) => [node.id, node]));
  const userEdgeCount = world.edges.filter((edge) => byId.get(edge.from)?.kind === 'users').length;

  const nodes: SimState['nodes'] = {};
  const edges: SimState['edges'] = {};
  const incomingByNode = new Map<string, number>();

  for (const id of order) {
    const node = byId.get(id);
    if (!node) continue;
    const out = outgoing.get(id) ?? [];

    let ratePerEdge: number;
    if (isWorkNode(node)) {
      const status = stepNode(
        node,
        previousNodes[id] ?? idleStatus,
        incomingByNode.get(id) ?? 0,
        world.rules,
        dt,
      );
      nodes[id] = status;
      ratePerEdge = out.length > 0 ? status.served / out.length : 0;
    } else {
      ratePerEdge = userEdgeCount > 0 ? arrivalRate / userEdgeCount : 0;
    }

    for (const edge of out) {
      edges[edge.id] = { rate: ratePerEdge };
      incomingByNode.set(edge.to, (incomingByNode.get(edge.to) ?? 0) + ratePerEdge);
    }
  }
  return { nodes, edges };
}

function applyAction(world: World, action: Action): World {
  switch (action.type) {
    case 'setUsers':
      return { ...world, traffic: { ...world.traffic, users: Math.max(0, action.users) } };
    case 'replaceWorld':
      // Nodes that keep their id keep their waiting line: a fix doesn't erase the backlog.
      flowOrder(action.world);
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

function sumTotals(
  world: World,
  graph: Graph,
  nodes: SimState['nodes'],
  edges: SimState['edges'],
  arrivalRate: number,
): Totals {
  const statuses = Object.values(nodes);
  const dropped = statuses.reduce((sum, status) => sum + status.dropped, 0);
  // A request is finished when the last box on its path serves it, not at every hop.
  const { outgoing } = graph;
  const finished = world.nodes
    .filter((node) => isWorkNode(node) && !outgoing.has(node.id))
    .reduce((sum, node) => sum + (nodes[node.id]?.served ?? 0), 0);

  const pathLatency = endToEndLatency(graph, nodes, edges);
  const users = world.nodes.filter((node) => node.kind === 'users');
  const userRate = (id: string) => sumRates(outgoing.get(id) ?? [], edges);
  const sent = users.reduce((sum, node) => sum + userRate(node.id), 0);
  const weightedLatency = users.reduce(
    (sum, node) => sum + (pathLatency.get(node.id) ?? 0) * userRate(node.id),
    0,
  );
  return {
    latencyMs: sent > 0 ? weightedLatency / sent : 0,
    errorRate: arrivalRate > 0 ? dropped / arrivalRate : 0,
    throughput: finished,
  };
}

/**
 * Time from a node to the end of the line: its own latency plus the next hops' times,
 * weighted by how much traffic each edge carries, so an idle spare box doesn't make the
 * average look better. Walked last hop first.
 */
function endToEndLatency(
  { order, outgoing }: Graph,
  nodes: SimState['nodes'],
  edges: SimState['edges'],
): Map<string, number> {
  const pathLatency = new Map<string, number>();
  for (const id of [...order].reverse()) {
    const out = outgoing.get(id) ?? [];
    const total = sumRates(out, edges);
    const downstream =
      total > 0
        ? out.reduce(
            (sum, edge) => sum + (pathLatency.get(edge.to) ?? 0) * (edges[edge.id]?.rate ?? 0),
            0,
          ) / total
        : 0;
    pathLatency.set(id, (nodes[id]?.latencyMs ?? 0) + downstream);
  }
  return pathLatency;
}

function sumRates(edgeList: readonly SimEdge[], edges: SimState['edges']): number {
  return edgeList.reduce((sum, edge) => sum + (edges[edge.id]?.rate ?? 0), 0);
}

function isWorkNode(node: World['nodes'][number]): node is WorkNode {
  return node.kind !== 'users';
}
