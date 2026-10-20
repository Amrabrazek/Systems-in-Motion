import { describe, expect, it } from 'vitest';
import { getNumber } from '../data/numbers';
import { createState, type WorkNode, type World } from '../engine';
import {
  MAX_SERVERS,
  decodeSpec,
  defaultSpec,
  encodeSpec,
  specToWorld,
  type DesignSpec,
  type ServerSize,
} from './spec';

// M4 step 2: the design spec and its share link (docs/milestones/m4-design-v0.md, ADR 0015).

/** Every builder combination the v0 panel can make. */
function everySpec(): DesignSpec[] {
  const specs: DesignSpec[] = [];
  for (const loadBalancer of [true, false])
    for (const cache of [true, false])
      for (const size of ['small', 'big'] as ServerSize[])
        for (let count = 1; count <= (loadBalancer ? MAX_SERVERS : 1); count++)
          specs.push({ ...defaultSpec, loadBalancer, cache, servers: { count, size } });
  return specs;
}

const node = (world: World, id: string) => world.nodes.find((candidate) => candidate.id === id);
const encodeRaw = (raw: unknown) => btoa(JSON.stringify(raw));

describe('specToWorld', () => {
  it('makes a valid graph for every builder combination, with region and zone on every node', () => {
    for (const spec of everySpec()) {
      const world = specToWorld(spec);
      expect(() => createState(world)).not.toThrow();
      for (const each of world.nodes) {
        expect(each.region).toBeTruthy();
        expect(each.zone).toBeTruthy();
      }
    }
  });

  it('builds users → LB → servers → cache → database', () => {
    const world = specToWorld({
      ...defaultSpec,
      servers: { count: 3, size: 'small' },
      cache: true,
    });
    expect(world.edges.map((edge) => `${edge.from}>${edge.to}`)).toEqual([
      'users>lb',
      'lb>a',
      'lb>b',
      'lb>c',
      'a>cache',
      'b>cache',
      'c>cache',
      'cache>db',
    ]);
  });

  it('without a load balancer, users go straight to one server', () => {
    const world = specToWorld({
      ...defaultSpec,
      loadBalancer: false,
      servers: { count: 1, size: 'small' },
    });
    expect(node(world, 'lb')).toBeUndefined();
    expect(world.edges.map((edge) => `${edge.from}>${edge.to}`)).toEqual(['users>a', 'a>db']);
  });

  it('keeps box ids when the design changes, so waiting lines and kills stay on them', () => {
    const two = specToWorld({ ...defaultSpec, servers: { count: 2, size: 'small' } });
    const four = specToWorld({ ...defaultSpec, servers: { count: 4, size: 'small' }, cache: true });
    for (const id of ['users', 'lb', 'a', 'b', 'db']) {
      expect(node(two, id)).toBeDefined();
      expect(node(four, id)).toBeDefined();
    }
  });

  it('server size picks the capacity, with its tag', () => {
    const big = node(
      specToWorld({ ...defaultSpec, servers: { count: 1, size: 'big' } }),
      'a',
    ) as WorkNode;
    expect(big.capacity).toEqual(getNumber('teaching', 'server.big.capacity'));
  });

  it('your own number reaches every server with tag U; others keep their defaults', () => {
    const world = specToWorld({ ...defaultSpec, overrides: { 'server.capacity': 120 } });
    for (const id of ['a', 'b']) {
      const server = node(world, id) as WorkNode;
      expect(server.capacity.value).toBe(120);
      expect(server.capacity.tag).toBe('U');
      expect(server.capacity.source).toBeUndefined();
      expect(server.baseLatencyMs).toEqual(getNumber('teaching', 'server.baseLatencyMs'));
    }
  });

  it('users and traffic come from the spec', () => {
    const world = specToWorld({
      ...defaultSpec,
      users: 2500,
      overrides: { 'traffic.requestsPerUserPerSec': 0.5 },
    });
    expect(world.traffic.users).toBe(2500);
    expect(world.traffic.requestsPerUserPerSec).toMatchObject({ value: 0.5, tag: 'U' });
  });
});

describe('share link', () => {
  it('round-trips every builder combination', () => {
    for (const spec of everySpec())
      expect(decodeSpec(encodeSpec(spec))).toEqual({ ok: true, spec });
  });

  it('round-trips your own numbers', () => {
    const spec: DesignSpec = {
      ...defaultSpec,
      overrides: { 'server.capacity': 120, 'cache.ttlSeconds': 5, 'db.queueMax': 0 },
    };
    expect(decodeSpec(encodeSpec(spec))).toEqual({ ok: true, spec });
  });

  it('is URL-safe and short', () => {
    const text = encodeSpec({ ...defaultSpec, overrides: { 'server.capacity': 120 } });
    expect(text).toMatch(/^[A-Za-z0-9_-]+$/);
    expect(text.length).toBeLessThan(300);
  });

  it.each([
    ['not base64 or JSON', '%%%'],
    ['JSON but not an object', encodeRaw([1, 2])],
    ['another version', encodeRaw({ ...defaultSpec, v: 2 })],
    ['too many servers', encodeRaw({ ...defaultSpec, servers: { count: 9, size: 'small' } })],
    ['zero servers', encodeRaw({ ...defaultSpec, servers: { count: 0, size: 'small' } })],
    ['unknown size', encodeRaw({ ...defaultSpec, servers: { count: 1, size: 'huge' } })],
    ['several servers, no LB', encodeRaw({ ...defaultSpec, loadBalancer: false })],
    ['users not whole', encodeRaw({ ...defaultSpec, users: 10.5 })],
    ['users too many', encodeRaw({ ...defaultSpec, users: 1e9 })],
    ['unknown number', encodeRaw({ ...defaultSpec, overrides: { 'server.color': 1 } })],
    ['negative number', encodeRaw({ ...defaultSpec, overrides: { 'db.capacity': -1 } })],
    ['zero capacity', encodeRaw({ ...defaultSpec, overrides: { 'server.capacity': 0 } })],
    ['number as text', encodeRaw({ ...defaultSpec, overrides: { 'db.capacity': '60' } })],
    ['extra field', encodeRaw({ ...defaultSpec, script: 'x' })],
  ])('rejects a broken link: %s', (_, text) => {
    const result = decodeSpec(text);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toBeTruthy();
  });
});
