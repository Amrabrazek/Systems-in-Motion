import { describe, expect, it } from 'vitest';
import { nodeIdsFor, parts, partsFor } from './numbers';
import { OVERRIDE_KEYS, defaultSpec, specToWorld } from './spec';

// M4 step 4: the Numbers panel's parts (docs/milestones/m4-design-v0.md).

describe('Numbers panel parts', () => {
  it('shows every number you can override exactly once, each with a definition', () => {
    const keys = parts.flatMap((part) => part.rows.map((row) => row.key));
    expect([...keys].sort()).toEqual([...OVERRIDE_KEYS].sort());
    for (const row of parts.flatMap((part) => part.rows)) expect(row.definition).toBeTruthy();
  });

  it('has no tab for a load balancer or cache the design does not have', () => {
    const ids = (spec: typeof defaultSpec) => partsFor(spec).map((part) => part.id);
    expect(ids(defaultSpec)).toEqual(['traffic', 'lb', 'servers', 'db']);
    expect(ids({ ...defaultSpec, cache: true })).toContain('cache');
    expect(
      ids({ ...defaultSpec, loadBalancer: false, servers: { count: 1, size: 'small' } }),
    ).not.toContain('lb');
  });

  it('lights the boxes a part applies to', () => {
    const world = specToWorld({ ...defaultSpec, servers: { count: 3, size: 'small' } });
    expect(nodeIdsFor(world, 'servers')).toEqual(['a', 'b', 'c']);
    expect(nodeIdsFor(world, 'db')).toEqual(['db']);
    expect(nodeIdsFor(world, 'cache')).toEqual([]);
  });
});
