// Sizes of the Flow stage parts, in SVG units (the viewBox scales them). Where each part goes
// is worked out from the world graph by layout.ts (ADR 0012).
export const STAGE = {
  minWidth: 760,
  minHeight: 290,
  baseMiddle: 135, // the M1 centre line: the users group and a single box sit on it
  rightMargin: 40,
  bottomMargin: 50, // room for the column caption under the lowest box
  topMargin: 30,
  people: { columns: 5, rows: 8, gap: 20, x: 50, radius: 5.5 },
  usersRight: 150, // where requests leave the users group
  queue: { slots: 24, size: 7, gap: 9, track: 222 }, // track: line start → box door
  doorGap: 8, // the waiting line stops this far before the box
  box: { width: 160, height: 104, compactHeight: 72, gap: 24 },
  router: { width: 124, height: 72 },
  cache: { width: 184, height: 88 }, // no waiting line: it answers from memory or passes on
  edge: { min: 40, fan: 80 }, // shortest edge; longer when it fans out to several boxes
} as const;

export const QUEUE_SLOTS = STAGE.queue.slots;
const PEOPLE = STAGE.people.columns * STAGE.people.rows;

/** People to light up: grows with the log of users, so 10 and 10,000 both read. */
export function peopleShown(users: number): number {
  if (users <= 0) return 0;
  return Math.min(PEOPLE, Math.max(1, Math.round((PEOPLE * Math.log10(users)) / 4)));
}

/** Waiting-line slots to fill, so a single waiting request still shows. */
export function slotsFilled(queueLength: number, queueMax: number): number {
  if (queueLength <= 0 || queueMax <= 0) return 0;
  return Math.min(QUEUE_SLOTS, Math.max(1, Math.ceil((queueLength / queueMax) * QUEUE_SLOTS)));
}
