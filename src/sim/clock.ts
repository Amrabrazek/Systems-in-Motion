/**
 * Where the loop gets time and frames from. The browser version uses requestAnimationFrame;
 * tests pass a fake one and move time by hand, so no test ever waits on a real timer.
 */
export interface FrameClock {
  now(): number; // milliseconds
  requestFrame(callback: (nowMs: number) => void): number;
  cancelFrame(id: number): void;
}

export const browserClock: FrameClock = {
  now: () => performance.now(),
  requestFrame: (callback) => requestAnimationFrame(callback),
  cancelFrame: (id) => cancelAnimationFrame(id),
};
