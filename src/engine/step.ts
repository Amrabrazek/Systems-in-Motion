import { edgesByFrom, flowOrder } from './graph';
import { edgesInUse, isReallyUp, updateLbView } from './loadBalancer';
import { emptyTotals, smoothTotals } from './metrics';
import { createRng } from './rng';
import type {
  Action,
  Health,
  LoadBalancerNode,
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
    nodes: Object.fromEntries(
      world.nodes.filter((node) => node.kind !== 'users').map((node) => [node.id, idleStatus]),
    ),
    edges: Object.fromEntries(world.edges.map((edge) => [edge.id, { rate: 0 }])),
    lbView: updateLbView(world, {}, 0),
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
  // Beliefs first: a kill in this step's actions starts the health-check clock now.
  const lbView = updateLbView(world, state.lbView, dt);
  const { nodes, edges } = flowThrough(world, graph, state.nodes, lbView, arrivalRate, dt);

  const totals = sumTotals(world, graph, nodes, edges, arrivalRate);
  return {
    time: state.time + dt,
    world,
    rng: state.rng,
    nodes,
    edges,
    lbView,
    totals,
    smoothed: smoothTotals(state.smoothed, totals, dt, world.rules.smoothingSeconds.value),
  };
}

/**
 * Walk the graph in flow order: what a box serves this step is what its outgoing edges carry,
 * split evenly. Users split the arrival rate evenly across all their edges. A load balancer
 * splits evenly across the targets it believes are up; see docs/engine.md.
 */
function flowThrough(
  world: World,
  { order, outgoing }: Graph,
  previousNodes: SimState['nodes'],
  lbView: SimState['lbView'],
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
    const incoming = incomingByNode.get(id) ?? 0;

    let sendsTo: readonly SimEdge[] = out;
    let ratePerEdge: number;
    if (node.kind === 'loadBalancer') {
      nodes[id] = routerStatus(node, incoming, out.length > 0);
      sendsTo = edgesInUse(out, lbView[id]);
      ratePerEdge = sendsTo.length > 0 ? incoming / sendsTo.length : 0;
    } else if (isWorkNode(node)) {
      const status = stepNode(node, previousNodes[id] ?? idleStatus, incoming, world.rules, dt);
      nodes[id] = status;
      ratePerEdge = out.length > 0 ? status.served / out.length : 0;
    } else {
      ratePerEdge = userEdgeCount > 0 ? arrivalRate / userEdgeCount : 0;
    }

    for (const edge of out) {
      const rate = sendsTo.includes(edge) ? ratePerEdge : 0;
      edges[edge.id] = { rate };
      incomingByNode.set(edge.to, (incomingByNode.get(edge.to) ?? 0) + rate);
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
    case 'killNode':
      return setUp(world, action.nodeId, false);
    case 'reviveNode':
      return setUp(world, action.nodeId, true);
  }
}

function setUp(world: World, nodeId: string, up: boolean): World {
  const target = world.nodes.find((node) => node.id === nodeId);
  // Only servers can die in M2. Anything else is a bug in the page, so fail loudly.
  if (target?.kind !== 'server')
    throw new Error(`can only kill or revive a server, got '${nodeId}'`);
  return {
    ...world,
    nodes: world.nodes.map((node) => (node.id === nodeId ? { ...node, up } : node)),
  };
}

/**
 * A load balancer does no work (ADR 0011): it passes everything on and adds a little time.
 * With no targets at all, there is nowhere to send, so it turns everything away.
 */
function routerStatus(node: LoadBalancerNode, incoming: number, hasTargets: boolean): NodeStatus {
  return {
    ...idleStatus,
    incoming,
    served: hasTargets ? incoming : 0,
    dropped: hasTargets ? 0 : incoming,
    latencyMs: node.baseLatencyMs.value,
  };
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
    // The waiting line dies with the box. It counts as dropped once; the next step it's 0.
    const lostLine = previous.queueLength / dt;
    return { ...idleStatus, incoming, dropped: incoming + lostLine, health: 'bad' };
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

  const pathLatency = endToEndLatency(world, graph, nodes, edges);
  const users = world.nodes.filter((node) => node.kind === 'users');
  const userRate = (id: string) => sumRates(outgoing.get(id) ?? [], edges);
  const sent = users.reduce((sum, node) => sum + userRate(node.id), 0);
  const weightedLatency = users.reduce(
    (sum, node) => sum + (pathLatency.get(node.id) ?? 0) * userRate(node.id),
    0,
  );
  return {
    latencyMs: sent > 0 ? weightedLatency / sent : 0,
    // Capped: a killed box's lost line can briefly drop more per second than arrives.
    errorRate: arrivalRate > 0 ? Math.min(1, dropped / arrivalRate) : 0,
    throughput: finished,
  };
}

/**
 * Time from a node to the end of the line: its own latency plus the next hops' times,
 * weighted by how much traffic each edge carries, so an idle spare box doesn't make the
 * average look better. A dead box answers no one, so its 0 ms doesn't count either:
 * otherwise latency would look better during an outage. Walked last hop first.
 */
function endToEndLatency(
  world: World,
  { order, outgoing }: Graph,
  nodes: SimState['nodes'],
  edges: SimState['edges'],
): Map<string, number> {
  const byId = new Map(world.nodes.map((node) => [node.id, node]));
  const answeredRate = (edge: SimEdge) =>
    isReallyUp(byId.get(edge.to)) ? (edges[edge.id]?.rate ?? 0) : 0;

  const pathLatency = new Map<string, number>();
  for (const id of [...order].reverse()) {
    const out = outgoing.get(id) ?? [];
    const total = out.reduce((sum, edge) => sum + answeredRate(edge), 0);
    const downstream =
      total > 0
        ? out.reduce((sum, edge) => sum + (pathLatency.get(edge.to) ?? 0) * answeredRate(edge), 0) /
          total
        : 0;
    pathLatency.set(id, (nodes[id]?.latencyMs ?? 0) + downstream);
  }
  return pathLatency;
}

function sumRates(edgeList: readonly SimEdge[], edges: SimState['edges']): number {
  return edgeList.reduce((sum, edge) => sum + (edges[edge.id]?.rate ?? 0), 0);
}

function isWorkNode(node: World['nodes'][number]): node is WorkNode {
  return node.kind === 'server';
}
