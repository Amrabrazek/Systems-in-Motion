import type { NumberEntry, NumberProfile } from '../../engine/types';
import { measured } from './measured';
import { teaching } from './teaching';
import { typical } from './typical';

export const profiles: Record<NumberProfile, NumberEntry[]> = { teaching, typical, measured };

/** Look a number up by id. Throws so a typo fails loudly instead of becoming `undefined`. */
export function getNumber(profile: NumberProfile, id: string): NumberEntry {
  const entry = profiles[profile].find((candidate) => candidate.id === id);
  if (!entry) throw new Error(`No number '${id}' in the ${profile} profile`);
  return entry;
}
