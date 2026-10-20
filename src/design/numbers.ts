import type { World } from '../engine';
import type { DesignSpec, OverrideKey } from './spec';

// What the Numbers panel shows, part by part (docs/milestones/m4-design-v0.md, step 4).
// Design uses real terms; each one gets a one-line definition (CLAUDE.md "Content rules").

export type PartId = 'traffic' | 'lb' | 'servers' | 'cache' | 'db';

export interface NumberRow {
  key: OverrideKey;
  label: string;
  definition: string;
}

export interface Part {
  id: PartId;
  title: string;
  rows: NumberRow[];
}

export const parts: Part[] = [
  {
    id: 'traffic',
    title: 'Traffic',
    rows: [
      {
        key: 'traffic.requestsPerUserPerSec',
        label: 'Requests per user',
        definition: 'How many requests one user sends each second.',
      },
    ],
  },
  {
    id: 'lb',
    title: 'Load balancer',
    rows: [
      {
        key: 'lb.baseLatencyMs',
        label: 'Added latency',
        definition: 'Time the load balancer adds to every request.',
      },
      {
        key: 'lb.healthCheckSeconds',
        label: 'Health-check delay',
        definition: 'How long before it notices a server died or came back.',
      },
    ],
  },
  {
    id: 'servers',
    title: 'Servers',
    rows: [
      {
        key: 'server.capacity',
        label: 'Capacity',
        definition: 'Requests per second one server can finish.',
      },
      {
        key: 'server.baseLatencyMs',
        label: 'Base latency',
        definition: 'Time per request when the server is idle.',
      },
      {
        key: 'server.queueMax',
        label: 'Queue size',
        definition: 'Requests that can wait in line before new ones are turned away.',
      },
    ],
  },
  {
    id: 'cache',
    title: 'Cache',
    rows: [
      {
        key: 'cache.baseLatencyMs',
        label: 'Hit latency',
        definition: 'Time to answer from memory.',
      },
      {
        key: 'cache.ttlSeconds',
        label: 'TTL',
        definition:
          'How long a kept answer is used before it is fetched again. Longer = more hits, older data.',
      },
      {
        key: 'cache.keyCount',
        label: 'Distinct keys',
        definition: 'How many different things users ask for. Fewer keys = more hits.',
      },
    ],
  },
  {
    id: 'db',
    title: 'Database',
    rows: [
      {
        key: 'db.capacity',
        label: 'Capacity',
        definition: 'Queries per second the database can finish.',
      },
      {
        key: 'db.baseLatencyMs',
        label: 'Base latency',
        definition: 'Time per query when the database is idle.',
      },
      {
        key: 'db.queueMax',
        label: 'Queue size',
        definition: 'Queries that can wait in line before new ones are turned away.',
      },
    ],
  },
];

/** Parts in this design: no tab for a load balancer or cache you haven't added. */
export const partsFor = (spec: DesignSpec): Part[] =>
  parts.filter(
    (part) => (part.id !== 'lb' || spec.loadBalancer) && (part.id !== 'cache' || spec.cache),
  );

/** The boxes on the stage that a part's numbers apply to, to light them while it's open. */
export function nodeIdsFor(world: World, part: PartId): string[] {
  const kind = {
    traffic: 'users',
    lb: 'loadBalancer',
    servers: 'server',
    cache: 'cache',
    db: 'database',
  }[part];
  return world.nodes.filter((node) => node.kind === kind).map((node) => node.id);
}
