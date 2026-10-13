export const USERS_COLUMNS = 4;
export const USERS_ROWS = 3;
export const QUEUE_SLOTS = 15;

/** How many person icons to light up: one more per doubling, so 10 and 10,000 both read. */
export function peopleShown(users: number): number {
  const total = USERS_COLUMNS * USERS_ROWS;
  if (users <= 0) return 0;
  return Math.min(total, Math.max(1, Math.round(Math.log2(users / 5))));
}

/** Waiting-line slots to fill, so a single waiting request still shows. */
export function slotsFilled(queueLength: number, queueMax: number): number {
  if (queueLength <= 0 || queueMax <= 0) return 0;
  return Math.min(QUEUE_SLOTS, Math.max(1, Math.round((queueLength / queueMax) * QUEUE_SLOTS)));
}
