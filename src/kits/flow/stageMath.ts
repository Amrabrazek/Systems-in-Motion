// Geometry of the one-box Flow stage, in SVG units (the viewBox scales it). Shared with the
// DotLayer in step 5 so dots follow the same paths the stage draws.
export const STAGE = {
  width: 760,
  height: 320,
  middle: 160,
  people: { columns: 5, rows: 8, gap: 20, x: 50, radius: 5.5 },
  usersRight: 150, // where requests leave the users group
  queue: { start: 330, slots: 24, size: 7, gap: 9 },
  box: { x: 560, width: 160, height: 104 },
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
