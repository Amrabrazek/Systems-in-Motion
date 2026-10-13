// Shared engine types. The full data model (SimNode, World, SimState, Action) lands with
// the engine in M1 step 2; see docs/architecture.md.

/** M Measured · R Rule of thumb · T Teaching guess · U the user's own number. */
export type Tag = 'M' | 'R' | 'T' | 'U';

/** One number the engine may read, with where it came from (ADR 0009). */
export interface NumberEntry {
  id: string; // e.g. 'server.small.capacity'
  value: number;
  unit: string;
  range?: [number, number]; // for R: the honest spread
  tag: Tag;
  note: string; // one line: what it assumes
  source?: { title: string; url: string; date: string }; // required for M and R
}

export type NumberProfile = 'teaching' | 'typical' | 'measured';
