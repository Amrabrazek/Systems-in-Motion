import type { SimEdge, World } from './types';

/**
 * Node ids in the order traffic reaches them: every box comes after all the boxes that send
 * to it, so one pass per step is enough. Throws on a cycle (traffic would loop forever in flow
 * math) and on an edge to a node that isn't in the world.
 */
export function flowOrder(world: World): string[] {
  const ids = new Set(world.nodes.map((node) => node.id));
  const waitingOn = new Map<string, number>(world.nodes.map((node) => [node.id, 0]));
  for (const edge of world.edges) {
    if (!ids.has(edge.from) || !ids.has(edge.to)) {
      throw new Error(`edge ${edge.id} points at a node that is not in the world`);
    }
    waitingOn.set(edge.to, (waitingOn.get(edge.to) ?? 0) + 1);
  }

  const outgoing = edgesByFrom(world.edges);
  // Kahn's algorithm, seeded in world order so the result is stable for the same world.
  const ready = world.nodes.filter((node) => waitingOn.get(node.id) === 0).map((n) => n.id);
  const order: string[] = [];
  for (const id of ready) {
    order.push(id);
    for (const edge of outgoing.get(id) ?? []) {
      const left = (waitingOn.get(edge.to) ?? 0) - 1;
      waitingOn.set(edge.to, left);
      if (left === 0) ready.push(edge.to);
    }
  }

  if (order.length < world.nodes.length) {
    const stuck = world.nodes.filter((node) => !order.includes(node.id)).map((n) => n.id);
    throw new Error(`world has a cycle through: ${stuck.join(', ')}`);
  }
  return order;
}

export function edgesByFrom(edges: readonly SimEdge[]): Map<string, SimEdge[]> {
  const byFrom = new Map<string, SimEdge[]>();
  for (const edge of edges) byFrom.set(edge.from, [...(byFrom.get(edge.from) ?? []), edge]);
  return byFrom;
}
