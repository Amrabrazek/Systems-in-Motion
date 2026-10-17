import { flowOrder, type SimNode, type World } from '../../engine';
import { STAGE } from './stageMath';

export type Point = readonly [x: number, y: number];

type BoxNode = Exclude<SimNode, { kind: 'users' }>;

/** Boxes that do work (servers, databases) have a waiting line; routers and caches don't. */
export const hasWaitingLine = (kind: SimNode['kind']) => kind === 'server' || kind === 'database';

/** Where one box sits. `entry` is where its incoming edges end; `exit` where outgoing ones start. */
export interface BoxPlace {
  id: string;
  kind: BoxNode['kind'];
  column: number;
  x: number;
  top: number;
  width: number;
  height: number;
  centerY: number;
  compact: boolean; // short box: three or more in a column
  entry: Point; // work boxes: the start of the waiting line; routers and caches: the left side
  door: Point; // work boxes: the end of the waiting line; routers and caches: same as entry
  exit: Point; // right side, where answered or forwarded requests leave
}

export interface StageLayout {
  width: number;
  height: number;
  middle: number; // the users group sits on this line
  usersExit: Point;
  boxes: Record<string, BoxPlace>;
  columns: string[][]; // box ids per column, users column (0) left out
  edges: Record<string, { from: Point; to: Point; fromUsers: boolean }>;
}

/**
 * Lay the stage out from the graph (ADR 0012): one column per hop from the users, boxes spread
 * evenly down each column. Pure, so it is tested without drawing. A column is as wide as its
 * widest box plus the edge into it; spare room goes to the first edge, so a short chain looks
 * like M1 and a long one widens the viewBox rather than squashing the waiting lines.
 */
export function layoutColumns(world: World): StageLayout {
  const byId = new Map(world.nodes.map((node) => [node.id, node]));
  const columnOf = hopColumns(world);
  const columns: string[][] = [];
  for (const id of flowOrder(world)) {
    const column = columnOf.get(id) ?? 0;
    if (column === 0) continue;
    (columns[column - 1] ??= []).push(id);
  }
  const filled = columns.filter((ids) => ids.length > 0);

  const shapes = filled.map((ids) => ids.map((id) => shapeOf(byId.get(id) as BoxNode, ids.length)));
  const spans = shapes.map((column) =>
    column.reduce((sum, shape, index) => sum + shape.height + (index > 0 ? STAGE.box.gap : 0), 0),
  );
  const tallest = Math.max(0, ...spans);
  const middle = Math.max(STAGE.baseMiddle, STAGE.topMargin + tallest / 2);
  const height = Math.max(STAGE.minHeight, middle + tallest / 2 + STAGE.bottomMargin);

  const edgeLengths = filled.map((ids, index) =>
    ids.length > (filled[index - 1]?.length ?? 1) ? STAGE.edge.fan : STAGE.edge.min,
  );
  const columnWidths = shapes.map((column) => Math.max(...column.map((shape) => shape.reach)));
  const needed =
    STAGE.usersRight +
    edgeLengths.reduce((sum, length) => sum + length, 0) +
    columnWidths.reduce((sum, width) => sum + width, 0);
  const width = Math.max(STAGE.minWidth, needed + STAGE.rightMargin);
  const slack = width - STAGE.rightMargin - needed;

  const boxes: Record<string, BoxPlace> = {};
  let cursor = STAGE.usersRight;
  filled.forEach((ids, index) => {
    cursor += (edgeLengths[index] ?? 0) + (index === 0 ? slack : 0) + (columnWidths[index] ?? 0);
    let top = middle - (spans[index] ?? 0) / 2;
    ids.forEach((id, row) => {
      const shape = shapes[index]?.[row];
      if (!shape) return;
      boxes[id] = place(id, shape, index + 1, cursor - shape.width, top);
      top += shape.height + STAGE.box.gap;
    });
  });

  const usersExit: Point = [STAGE.usersRight, middle];
  const edges: StageLayout['edges'] = {};
  for (const edge of world.edges) {
    const target = boxes[edge.to];
    if (!target) continue;
    const source = boxes[edge.from];
    edges[edge.id] = { from: source?.exit ?? usersExit, to: target.entry, fromUsers: !source };
  }

  return { width, height, middle, usersExit, boxes, columns: filled, edges };
}

/** Column per node: the longest hop count from a users node, so a box sits right of all senders. */
function hopColumns(world: World): Map<string, number> {
  const columns = new Map<string, number>();
  for (const id of flowOrder(world)) {
    const senders = world.edges.filter((edge) => edge.to === id);
    columns.set(id, Math.max(0, ...senders.map((edge) => (columns.get(edge.from) ?? 0) + 1)));
  }
  return columns;
}

interface Shape {
  kind: BoxPlace['kind'];
  width: number;
  height: number;
  reach: number; // box plus its waiting line: the room it needs left of its right edge
  compact: boolean;
}

function shapeOf(node: BoxNode, inColumn: number): Shape {
  if (node.kind === 'loadBalancer') {
    const { width, height } = STAGE.router;
    return { kind: 'loadBalancer', width, height, reach: width, compact: false };
  }
  if (node.kind === 'cache') {
    const { width, height } = STAGE.cache;
    return { kind: 'cache', width, height, reach: width, compact: false };
  }
  const compact = inColumn > 2;
  const { width } = STAGE.box;
  return {
    kind: node.kind,
    width,
    height: compact ? STAGE.box.compactHeight : STAGE.box.height,
    reach: width + STAGE.doorGap + STAGE.queue.track,
    compact,
  };
}

function place(id: string, shape: Shape, column: number, x: number, top: number): BoxPlace {
  const centerY = top + shape.height / 2;
  const lined = hasWaitingLine(shape.kind);
  const door: Point = lined ? [x - STAGE.doorGap, centerY] : [x, centerY];
  const entry: Point = lined ? [door[0] - STAGE.queue.track, centerY] : door;
  return {
    id,
    kind: shape.kind,
    column,
    x,
    top,
    width: shape.width,
    height: shape.height,
    centerY,
    compact: shape.compact,
    entry,
    door,
    exit: [x + shape.width, centerY],
  };
}

// The stage and the dots both need the layout every frame; the world only changes on actions.
const cache = new WeakMap<World, StageLayout>();

export function stageLayout(world: World): StageLayout {
  let layout = cache.get(world);
  if (!layout) {
    layout = layoutColumns(world);
    cache.set(world, layout);
  }
  return layout;
}
