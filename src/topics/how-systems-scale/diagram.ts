/**
 * The "how systems scale" picture as data. Every part has one fixed cell, so a part never moves
 * between steps: the reader sees the system grow around what they already know.
 */

export type PartId =
  | 'users'
  | 'cdn'
  | 'lb'
  | 'servers'
  | 'cache'
  | 'queue'
  | 'workers'
  | 'db'
  | 'replicas'
  | 'regionA'
  | 'regionB';

export interface DiagramPart {
  id: PartId;
  label: string;
  /** Draw stacked copies behind the box (three servers, two read copies…). */
  copies?: number;
  /** Draw a dashed spare behind the box: the count changes with load. */
  elastic?: boolean;
  /** Same part, bigger machine (scale up). */
  big?: boolean;
}

export interface DiagramEdge {
  from: PartId;
  to: PartId;
  /** Data being copied, not requests flowing: drawn dashed. */
  copy?: boolean;
}

export interface Diagram {
  parts: DiagramPart[];
  edges: DiagramEdge[];
  /** The part that hits its limit next, with the word shown after "!" (never color alone). */
  limit?: { part: PartId; word: string };
}

/** Grid cell in the wide layout: columns run left to right in request order. */
export interface Cell {
  col: number;
  row: number;
  /** Columns covered (rows covered once the grid is turned on its side). */
  span?: number;
  /** Rows covered: only region frames are taller than one cell. */
  tall?: number;
}

export const cells: Record<PartId, Cell> = {
  users: { col: 0, row: 1 },
  cdn: { col: 1, row: 0 },
  lb: { col: 1, row: 1 },
  servers: { col: 2, row: 1 },
  cache: { col: 3, row: 0 },
  queue: { col: 3, row: 2 },
  workers: { col: 4, row: 2 },
  db: { col: 4, row: 1 },
  replicas: { col: 4, row: 0 },
  regionA: { col: 1, row: 0, span: 4, tall: 3 },
  regionB: { col: 1, row: 3, span: 4 },
};

/** Region frames hold other parts; they draw behind them and have no box of their own. */
export const isFrame = (id: PartId) => id === 'regionA';

/** A cell that stays empty in every step, so the region name never sits on a box. */
export const regionLabelCell: Cell = { col: 2, row: 0 };

export const GRID_COLUMNS = 5;

export type Orientation = 'wide' | 'narrow';

export interface Geometry {
  cellWidth: number;
  cellHeight: number;
  boxWidth: number;
  boxHeight: number;
  /** Names longer than this (per cell) wrap onto a second line. */
  maxLabelChars: number;
  /** Same for the smaller mono lines ("! COPIES LAG"). */
  maxMonoChars: number;
}

// Narrow phones turn the grid on its side so the request path runs top to bottom.
export const geometry: Record<Orientation, Geometry> = {
  wide: {
    cellWidth: 136,
    cellHeight: 92,
    boxWidth: 116,
    boxHeight: 58,
    maxLabelChars: 14,
    maxMonoChars: 15,
  },
  narrow: {
    cellWidth: 92,
    cellHeight: 90,
    boxWidth: 84,
    boxHeight: 66,
    maxLabelChars: 9,
    maxMonoChars: 11,
  },
};

export interface Rect {
  x: number;
  y: number;
  width: number;
  height: number;
}

/** Turn a wide-layout cell into grid x/y and spans for the chosen orientation. */
export function gridPosition(cell: Cell, orientation: Orientation) {
  const spanCols = cell.span ?? 1;
  const spanRows = cell.tall ?? 1;
  return orientation === 'wide'
    ? { x: cell.col, y: cell.row, spanX: spanCols, spanY: spanRows }
    : { x: cell.row, y: cell.col, spanX: spanRows, spanY: spanCols };
}

/** The whole area of the cells a part covers. */
export function cellArea(cell: Cell, orientation: Orientation): Rect {
  const geo = geometry[orientation];
  const { x, y, spanX, spanY } = gridPosition(cell, orientation);
  return {
    x: x * geo.cellWidth,
    y: y * geo.cellHeight,
    width: spanX * geo.cellWidth,
    height: spanY * geo.cellHeight,
  };
}

/** The box drawn inside a part's cells, centered, with a gap to its neighbours. */
export function boxRect(cell: Cell, orientation: Orientation, big = false): Rect {
  const geo = geometry[orientation];
  const area = cellArea(cell, orientation);
  const grow = big ? 1.2 : 1;
  const width = area.width - (geo.cellWidth - geo.boxWidth * grow);
  const height = area.height - (geo.cellHeight - geo.boxHeight * grow);
  return {
    x: area.x + (area.width - width) / 2,
    y: area.y + (area.height - height) / 2,
    width,
    height,
  };
}

export function center(rect: Rect) {
  return { x: rect.x + rect.width / 2, y: rect.y + rect.height / 2 };
}

/** Rows used in the wide layout; the second region adds one. */
export function rowCount(diagram: Diagram): number {
  return diagram.parts.some((part) => part.id === 'regionB') ? 4 : 3;
}

export function canvasSize(diagram: Diagram, orientation: Orientation) {
  const geo = geometry[orientation];
  const cols = GRID_COLUMNS;
  const rows = rowCount(diagram);
  return orientation === 'wide'
    ? { width: cols * geo.cellWidth, height: rows * geo.cellHeight }
    : { width: rows * geo.cellWidth, height: cols * geo.cellHeight };
}

/** Split a label at spaces so no line is longer than `maxChars` (a single long word stays whole). */
export function wrapLabel(label: string, maxChars: number): string[] {
  const lines: string[] = [];
  for (const word of label.split(' ')) {
    const last = lines.length - 1;
    if (last >= 0 && `${lines[last]} ${word}`.length <= maxChars) {
      lines[last] = `${lines[last]} ${word}`;
    } else {
      lines.push(word);
    }
  }
  return lines;
}

export type Change = 'new' | 'changed';

/** What this step added or changed, so the picture can point at it. The first step has no "before". */
export function partChanges(before: Diagram | undefined, after: Diagram): Map<PartId, Change> {
  const changes = new Map<PartId, Change>();
  if (!before) return changes;
  for (const part of after.parts) {
    const old = before.parts.find((candidate) => candidate.id === part.id);
    if (!old) changes.set(part.id, 'new');
    else if (
      old.label !== part.label ||
      (old.copies ?? 1) !== (part.copies ?? 1) ||
      Boolean(old.elastic) !== Boolean(part.elastic) ||
      Boolean(old.big) !== Boolean(part.big)
    )
      changes.set(part.id, 'changed');
  }
  return changes;
}

/** One sentence for screen readers: the parts in request order, then the limit. */
export function describeDiagram(diagram: Diagram): string {
  const names = diagram.parts
    .filter((part) => !isFrame(part.id))
    .map((part) => (part.copies && part.copies > 1 ? `${part.label} ×${part.copies}` : part.label));
  const limit = diagram.limit && diagram.parts.find((part) => part.id === diagram.limit?.part);
  const limitText = limit && diagram.limit ? ` Limit: ${limit.label} (${diagram.limit.word}).` : '';
  return `Parts: ${names.join(', ')}.${limitText}`;
}
