import { describe, expect, it } from 'vitest';
import { createState, step, type WorkNode } from '../engine';
import { applyChange, keepLiveState, startBuilder, type Builder } from './builder';
import { MAX_SERVERS, MAX_USERS, defaultSpec, specToWorld } from './spec';

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
