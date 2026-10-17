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
 * A box that does work: an app server, or the database behind it (same math, ADR 0014).
 * Numbers are whole entries, not bare values, so the UI can show the tag and source beside
 * each one without a second lookup.
 */
export interface WorkNode {
  id: string;
  kind: 'server' | 'database';
  label: string;
  awsTag?: string; // small label, e.g. "EC2"
  capacity: NumberEntry; // requests/s it can finish
  queueMax: NumberEntry; // waiting line length before it turns requests away
  baseLatencyMs: NumberEntry; // time per request when idle
  region: string;
  zone: string;
  up: boolean; // false = killed
}

/**
 * Routes traffic; does no work, so it has no capacity or queue (ADR 0011). It splits evenly
 * across the targets it *believes* are up, and only notices a change after health checks.
 */
export interface LoadBalancerNode {
  id: string;
  kind: 'loadBalancer';
  label: string;
  awsTag?: string; // e.g. "ALB"
  baseLatencyMs: NumberEntry; // the little time it adds to every request
  healthCheckSeconds: NumberEntry; // how long a target must look different before the LB believes it
  region: string;
  zone: string;
}

/**
 * Keeps popular answers in memory (ADR 0014). Does no work, so it has no capacity or queue:
 * it answers hits itself and passes misses on to the next box. Its hit rate comes from how
 * long it keeps an answer (`ttlSeconds`) and how many different things users ask for.
 */
export interface CacheNode {
  id: string;
  kind: 'cache';
  label: string;
  awsTag?: string; // e.g. "ElastiCache"
  baseLatencyMs: NumberEntry; // time to answer from memory
  ttlSeconds: NumberEntry; // how long a kept answer is used before it's fetched again
  keyCount: NumberEntry; // how many different things users ask for
  region: string;
  zone: string;
  up: boolean; // false = killed; a dead cache passes every request on
}

export type SimNode = UsersNode | WorkNode | LoadBalancerNode | CacheNode;

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

/**
 * Would the system survive losing one more server? 'tight' = the rest hold but run busy
 * (past `rules.busyAt`), so latency climbs.
 */
export type SpareLevel = 'yes' | 'tight' | 'no';

/** Computed each step for every server and load balancer. Rates are requests/s. */
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

/**
 * What one load balancer believes about one target. Kept apart from the target's real `up`,
 * because the gap between the two is the error spike after a kill (ADR 0011).
 */
export interface TargetView {
  seenUp: boolean;
  mismatchSeconds: number; // how long reality has differed from `seenUp`; resets when they agree
}

/**
 * What one cache holds right now. `warmth` is the share of keys it has already fetched once:
 * 0 after a (re)start, rising toward 1 as requests arrive (ADR 0014).
 */
export interface CacheView {
  warmth: number;
  hitRate: number; // 0..1, share of incoming requests answered from memory this step
}

export interface SimState {
  time: number; // seconds of sim time
  world: World;
  rng: RngState;
  nodes: Record<string, NodeStatus>;
  edges: Record<string, { rate: number }>; // the UI samples dots from this
  lbView: Record<string, Record<string, TargetView>>; // load balancer id → target id → belief
  cacheView: Record<string, CacheView>; // cache id → how warm it is
  totals: Totals; // raw, this step
  smoothed: Totals; // EMA of totals; what charts draw (docs/engine.md, Smoothing)
}

export type Action =
  | { type: 'setUsers'; users: number }
  | { type: 'replaceWorld'; world: World }
  | { type: 'killNode'; nodeId: string }
  | { type: 'reviveNode'; nodeId: string };
