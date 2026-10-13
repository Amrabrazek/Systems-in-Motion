// Shared engine types. See docs/architecture.md (data model) and docs/engine.md (the math).

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

export type NodeKind = SimNode['kind'];

/** Where traffic comes from. It does no work, so it has no capacity or queue. */
export interface UsersNode {
  id: string;
  kind: 'users';
  label: string;
  region: string; // always set; the UI hides it until a topic needs it (ADR 0003)
  zone: string;
}

/**
 * A box that does work. Numbers are whole entries, not bare values, so the UI can show the
 * tag and source beside each one without a second lookup.
 */
export interface WorkNode {
  id: string;
  kind: 'server';
  label: string;
  awsTag?: string; // small label, e.g. "EC2"
  capacity: NumberEntry; // requests/s it can finish
  queueMax: NumberEntry; // waiting line length before it turns requests away
  baseLatencyMs: NumberEntry; // time per request when idle
  region: string;
  zone: string;
  up: boolean; // false = killed
}

export type SimNode = UsersNode | WorkNode;

export interface SimEdge {
  id: string;
  from: string;
  to: string;
}

/**
 * The thresholds of the model itself. They are numbers like any other, so they live in
 * src/data/numbers too (ADR 0009) and Design mode can show where they come from.
 */
export interface ModelRules {
  busyAt: NumberEntry; // utilization where a box turns yellow
  latencyCapAt: NumberEntry; // utilization where the latency curve stops rising, so it stays finite
  queueBadFraction: NumberEntry; // a line this full turns the box red
  smoothingSeconds: NumberEntry; // EMA time constant for charts
}

/** What a level or sandbox starts from. */
export interface World {
  nodes: SimNode[];
  edges: SimEdge[];
  traffic: { users: number; requestsPerUserPerSec: NumberEntry };
  rules: ModelRules;
  seed: number;
}

export type Health = 'ok' | 'warn' | 'bad';

/** Computed each step for every work node. Rates are requests/s. */
export interface NodeStatus {
  incoming: number;
  served: number;
  dropped: number;
  queueLength: number;
  utilization: number;
  latencyMs: number;
  health: Health;
}

export interface Totals {
  latencyMs: number;
  errorRate: number; // 0..1, share of requests turned away
  throughput: number; // requests/s served
}

export interface RngState {
  seed: number;
}

export interface SimState {
  time: number; // seconds of sim time
  world: World;
  rng: RngState;
  nodes: Record<string, NodeStatus>;
  edges: Record<string, { rate: number }>; // the UI samples dots from this
  totals: Totals; // raw, this step
  smoothed: Totals; // EMA of totals; what charts draw (docs/engine.md, Smoothing)
}

export type Action = { type: 'setUsers'; users: number } | { type: 'replaceWorld'; world: World };
