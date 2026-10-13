import { useSyncExternalStore } from 'react';
import type { Sim, SimSnapshot } from './loop';

/** React panels read the sim through this: they re-render ~10 times a second, not 60. */
export function useSim(sim: Sim): SimSnapshot {
  return useSyncExternalStore(sim.subscribe, sim.getSnapshot);
}
