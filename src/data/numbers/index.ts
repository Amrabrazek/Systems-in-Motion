import type { NumberEntry, NumberProfile } from '../../engine/types';
import { measured } from './measured';
import { teaching } from './teaching';
import { typical } from './typical';

export const profiles: Record<NumberProfile, NumberEntry[]> = { teaching, typical, measured };
