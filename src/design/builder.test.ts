import { describe, expect, it } from 'vitest';
import { createState, step, type WorkNode } from '../engine';
import { applyChange, keepLiveState, startBuilder, type Builder } from './builder';
import {
  MAX_SERVERS,
  MAX_USERS,
  decodeSpec,
  defaultSpec,
  encodeSpec,
  numberFor,
  overrideProblem,
  specToWorld,
} from './spec';

// M4 step 3: the Build panel's changes (docs/milestones/m4-design-v0.md).

const start = (): Builder => startBuilder(defaultSpec);
const upOf = (world: ReturnType<typeof specToWorld>, id: string) =>
  (world.nodes.find((node) => node.id === id) as WorkNode | undefined)?.up;

describe('applyChange', () => {
  it('turning the load balancer off leaves one server; on again brings back your count', () => {
    let builder = applyChange(start(), { type: 'setServerCount', count: 4 });
    builder = applyChange(builder, { type: 'setLoadBalancer', on: false });
    expect(builder.spec.servers.count).toBe(1);
    builder = applyChange(builder, { type: 'setLoadBalancer', on: true });
    expect(builder.spec.servers.count).toBe(4);
  });

  it('server count can not change without a load balancer', () => {
    const off = applyChange(start(), { type: 'setLoadBalancer', on: false });
    expect(applyChange(off, { type: 'setServerCount', count: 3 })).toBe(off);
  });

  it('keeps server count and users inside the limits', () => {
    expect(applyChange(start(), { type: 'setServerCount', count: 99 }).spec.servers.count).toBe(
      MAX_SERVERS,
    );
    expect(applyChange(start(), { type: 'setServerCount', count: 0 }).spec.servers.count).toBe(1);
    expect(applyChange(start(), { type: 'setUsers', users: 1e9 }).spec.users).toBe(MAX_USERS);
    expect(applyChange(start(), { type: 'setUsers', users: -5 }).spec.users).toBe(0);
  });

  it('size and cache change only themselves', () => {
    const big = applyChange(start(), { type: 'setServerSize', size: 'big' });
    expect(big.spec).toEqual({ ...defaultSpec, servers: { ...defaultSpec.servers, size: 'big' } });
    expect(applyChange(start(), { type: 'setCache', on: true }).spec.cache).toBe(true);
  });

  it('a link that starts without a load balancer still brings back the default count', () => {
    const builder = startBuilder({
      ...defaultSpec,
      loadBalancer: false,
      servers: { count: 1, size: 'small' },
    });
    expect(applyChange(builder, { type: 'setLoadBalancer', on: true }).spec.servers.count).toBe(
      defaultSpec.servers.count,
    );
  });
});

describe('your own numbers', () => {
  const set = (builder: Builder, value: number | undefined) =>
    applyChange(builder, { type: 'setOverride', key: 'server.capacity', value });

  it('an edit is stored, tagged U, and reaches the world', () => {
    const builder = set(start(), 120);
    expect(builder.spec.overrides).toEqual({ 'server.capacity': 120 });
    expect(numberFor(builder.spec, 'server.capacity')).toMatchObject({ value: 120, tag: 'U' });
  });

  it('reset, or typing the default back in, brings back the default with its own tag', () => {
    const typed = set(start(), 120);
    expect(set(typed, undefined).spec.overrides).toEqual({});
    const defaultValue = numberFor(defaultSpec, 'server.capacity').value;
    expect(set(typed, defaultValue).spec.overrides).toEqual({});
    expect(numberFor(set(typed, defaultValue).spec, 'server.capacity').tag).toBe('T');
  });

  it('a value the link would reject is never stored', () => {
    for (const bad of [-1, 0, Number.NaN, Number.POSITIVE_INFINITY]) {
      expect(set(start(), bad).spec.overrides).toEqual({});
    }
  });

  it('anything you can type survives the share link', () => {
    const builder = applyChange(set(start(), 120), {
      type: 'setOverride',
      key: 'db.queueMax',
      value: 0,
    });
    expect(decodeSpec(encodeSpec(builder.spec))).toEqual({ ok: true, spec: builder.spec });
  });

  it('picking a server size replaces a capacity you typed', () => {
    const big = applyChange(set(start(), 120), { type: 'setServerSize', size: 'big' });
    expect(big.spec.overrides).toEqual({});
    expect(numberFor(big.spec, 'server.capacity').value).toBe(
      numberFor({ ...defaultSpec, servers: { count: 1, size: 'big' } }, 'server.capacity').value,
    );
  });

  it('other numbers survive a size change', () => {
    const typed = applyChange(start(), { type: 'setOverride', key: 'db.capacity', value: 200 });
    const big = applyChange(typed, { type: 'setServerSize', size: 'big' });
    expect(big.spec.overrides).toEqual({ 'db.capacity': 200 });
  });

  it('says why a value is not usable', () => {
    expect(overrideProblem('server.capacity', Number.NaN)).toBe('Enter a number.');
    expect(overrideProblem('server.queueMax', -3)).toBe('Must be 0 or more.');
    expect(overrideProblem('server.capacity', 0)).toBe('Must be more than 0.');
    expect(overrideProblem('server.queueMax', 0)).toBeUndefined();
  });
});

describe('keepLiveState', () => {
  it('a killed server stays dead when the design changes around it', () => {
    const current = {
      ...specToWorld(defaultSpec),
      nodes: specToWorld(defaultSpec).nodes.map((node) =>
        node.id === 'b' ? { ...node, up: false } : node,
      ),
    };
    const next = keepLiveState(
      specToWorld({ ...defaultSpec, servers: { count: 3, size: 'small' }, cache: true }),
      current,
    );
    expect(upOf(next, 'a')).toBe(true);
    expect(upOf(next, 'b')).toBe(false);
    expect(upOf(next, 'c')).toBe(true);
  });

  it('keeps the users where the slider is', () => {
    const current = {
      ...specToWorld(defaultSpec),
      traffic: { ...specToWorld(defaultSpec).traffic, users: 4321 },
    };
    expect(keepLiveState(specToWorld(defaultSpec), current).traffic.users).toBe(4321);
  });

  it('the swapped-in world runs: waiting lines stay on boxes that keep their id', () => {
    const busy = { ...defaultSpec, users: 5000 };
    let state = createState(specToWorld(busy));
    for (let index = 0; index < 20; index++) state = step(state, [], 0.05);
    const lineBefore = state.nodes.a?.queueLength ?? 0;
    expect(lineBefore).toBeGreaterThan(0);
    const world = keepLiveState(specToWorld({ ...busy, cache: true }), state.world);
    state = step(state, [{ type: 'replaceWorld', world }], 0.05);
    expect(state.nodes.a?.queueLength ?? 0).toBeGreaterThan(0);
  });
});
