import { getNumber } from '../data/numbers';
import type { CacheNode, NumberEntry, SimEdge, SimNode, World, WorkNode } from '../engine';

// A design is a small spec, not a World (ADR 0015): short links, old links keep working, and
// only the numbers the engineer changed are stored. Defaults always come from src/data/numbers.

export const SPEC_VERSION = 1;
export const MAX_SERVERS = 8;
export const MAX_USERS = 100_000;

export type ServerSize = 'small' | 'big';

/** Numbers the engineer may type their own value for. One value per role: every server shares it. */
export const OVERRIDE_KEYS = [
  'traffic.requestsPerUserPerSec',
  'server.capacity',
  'server.baseLatencyMs',
  'server.queueMax',
  'lb.baseLatencyMs',
  'lb.healthCheckSeconds',
  'cache.baseLatencyMs',
  'cache.ttlSeconds',
  'cache.keyCount',
  'db.capacity',
  'db.baseLatencyMs',
  'db.queueMax',
] as const;
export type OverrideKey = (typeof OVERRIDE_KEYS)[number];

export interface DesignSpec {
  v: typeof SPEC_VERSION;
  users: number;
  loadBalancer: boolean; // off ⇒ exactly one server: nothing would split the traffic
  servers: { count: number; size: ServerSize };
  cache: boolean;
  overrides: Partial<Record<OverrideKey, number>>; // only what the engineer changed (tag U)
}

export const defaultSpec: DesignSpec = {
  v: SPEC_VERSION,
  users: 1000,
  loadBalancer: true,
  servers: { count: 2, size: 'small' },
  cache: false,
  overrides: {},
};

/** Must be above zero: a box that finishes nothing, or traffic with no requests, isn't a design. */
const MUST_BE_POSITIVE = new Set<OverrideKey>([
  'traffic.requestsPerUserPerSec',
  'server.capacity',
  'cache.keyCount',
  'db.capacity',
]);

const SERVER_IDS = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'] as const;
const place = { region: 'region-1', zone: 'zone-a' };
const n = (id: string) => getNumber('teaching', id);

/** The default entry behind an override key. Server capacity depends on the size picked. */
function defaultEntry(key: OverrideKey, size: ServerSize): NumberEntry {
  if (key === 'server.capacity') return n(`server.${size}.capacity`);
  return n(key);
}

export const isOverrideKey = (key: string): key is OverrideKey =>
  (OVERRIDE_KEYS as readonly string[]).includes(key);

/**
 * Why a typed value can't be used, or undefined if it can. One rule for the Numbers panel and
 * for share links, so a value you can type is always a value a link can carry.
 */
export function overrideProblem(key: OverrideKey, value: unknown): string | undefined {
  if (typeof value !== 'number' || !Number.isFinite(value)) return 'Enter a number.';
  if (value < 0) return 'Must be 0 or more.';
  if (MUST_BE_POSITIVE.has(key) && value === 0) return 'Must be more than 0.';
  return undefined;
}

/** The default for a key, before the engineer typed anything. */
export const defaultNumber = (spec: DesignSpec, key: OverrideKey): NumberEntry =>
  defaultEntry(key, spec.servers.size);

/** The engineer's own number: tag U, no source, since they typed it (CLAUDE.md "Content rules"). */
export function numberFor(spec: DesignSpec, key: OverrideKey): NumberEntry {
  const base = defaultEntry(key, spec.servers.size);
  const own = spec.overrides[key];
  if (own === undefined) return base;
  return { id: base.id, value: own, unit: base.unit, tag: 'U', note: 'Your number.' };
}

/**
 * Users → [load balancer] → servers → [cache] → database. Ids never change with the design,
 * so swapping the world in keeps waiting lines and kills on the boxes that stay.
 */
export function specToWorld(spec: DesignSpec): World {
  const number = (key: OverrideKey) => numberFor(spec, key);
  const serverIds = SERVER_IDS.slice(0, spec.loadBalancer ? spec.servers.count : 1);

  const servers: WorkNode[] = serverIds.map((id) => ({
    id,
    kind: 'server',
    label: `Server ${id.toUpperCase()}`,
    awsTag: 'EC2',
    capacity: number('server.capacity'),
    queueMax: number('server.queueMax'),
    baseLatencyMs: number('server.baseLatencyMs'),
    ...place,
    up: true,
  }));
  const cache: CacheNode = {
    id: 'cache',
    kind: 'cache',
    label: 'Cache',
    awsTag: 'ElastiCache',
    baseLatencyMs: number('cache.baseLatencyMs'),
    ttlSeconds: number('cache.ttlSeconds'),
    keyCount: number('cache.keyCount'),
    ...place,
    up: true,
  };
  const database: WorkNode = {
    id: 'db',
    kind: 'database',
    label: 'Database',
    awsTag: 'RDS',
    capacity: number('db.capacity'),
    queueMax: number('db.queueMax'),
    baseLatencyMs: number('db.baseLatencyMs'),
    ...place,
    up: true,
  };

  const nodes: SimNode[] = [{ id: 'users', kind: 'users', label: 'Users', ...place }];
  const edges: SimEdge[] = [];
  const link = (from: string, to: string) => edges.push({ id: `${from}-${to}`, from, to });

  if (spec.loadBalancer) {
    nodes.push({
      id: 'lb',
      kind: 'loadBalancer',
      label: 'Load balancer',
      awsTag: 'ALB',
      baseLatencyMs: number('lb.baseLatencyMs'),
      healthCheckSeconds: number('lb.healthCheckSeconds'),
      ...place,
    });
    link('users', 'lb');
    serverIds.forEach((id) => link('lb', id));
  } else {
    link('users', SERVER_IDS[0]);
  }
  nodes.push(...servers);

  const afterServers = spec.cache ? 'cache' : 'db';
  serverIds.forEach((id) => link(id, afterServers));
  if (spec.cache) {
    nodes.push(cache);
    link('cache', 'db');
  }
  nodes.push(database);

  return {
    nodes,
    edges,
    traffic: { users: spec.users, requestsPerUserPerSec: number('traffic.requestsPerUserPerSec') },
    rules: {
      busyAt: n('rules.busyAt'),
      latencyCapAt: n('rules.latencyCapAt'),
      queueBadFraction: n('rules.queueBadFraction'),
      smoothingSeconds: n('rules.smoothingSeconds'),
    },
    seed: 1,
  };
}

/** The spec for the share link: JSON, then base64url so it survives in a URL without escaping. */
export function encodeSpec(spec: DesignSpec): string {
  return btoa(JSON.stringify(spec)).replaceAll('+', '-').replaceAll('/', '_').replace(/=+$/, '');
}

export type DecodeResult = { ok: true; spec: DesignSpec } | { ok: false; error: string };

/**
 * Read a share link back. Anything wrong rejects the whole link rather than fixing it field by
 * field: "this link is broken" is honest, a silently changed design is not.
 */
export function decodeSpec(text: string): DecodeResult {
  let raw: unknown;
  try {
    raw = JSON.parse(atob(text.replaceAll('-', '+').replaceAll('_', '/')));
  } catch {
    return { ok: false, error: 'This link is not a design.' };
  }
  const error = problemWith(raw);
  return error ? { ok: false, error } : { ok: true, spec: raw as DesignSpec };
}

function problemWith(raw: unknown): string | undefined {
  if (!isRecord(raw)) return 'This link is not a design.';
  if (raw.v !== SPEC_VERSION) return 'This link is from a different version of Design.';
  const { users, loadBalancer, servers, cache, overrides } = raw;
  if (!isWhole(users) || users > MAX_USERS)
    return `Users must be a whole number up to ${MAX_USERS}.`;
  if (typeof loadBalancer !== 'boolean' || typeof cache !== 'boolean')
    return 'This link is broken.';
  if (!isRecord(servers) || (servers.size !== 'small' && servers.size !== 'big'))
    return 'This link is broken.';
  if (!isWhole(servers.count) || servers.count < 1 || servers.count > MAX_SERVERS)
    return `Servers must be 1 to ${MAX_SERVERS}.`;
  if (!loadBalancer && servers.count !== 1)
    return 'More than one server needs a load balancer to split the traffic.';
  if (!isRecord(overrides)) return 'This link is broken.';
  for (const [key, value] of Object.entries(overrides)) {
    if (!isOverrideKey(key)) return `Unknown number '${key}'.`;
    const problem = overrideProblem(key, value);
    if (problem) return `'${key}': ${problem}`;
  }
  // Extra keys would ride along unseen and come back in the next copied link.
  const known = ['v', 'users', 'loadBalancer', 'servers', 'cache', 'overrides'];
  if (Object.keys(raw).some((key) => !known.includes(key))) return 'This link is broken.';
  return undefined;
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const isWhole = (value: unknown): value is number => Number.isInteger(value) && Number(value) >= 0;
