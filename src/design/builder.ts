import type { World } from '../engine';
import {
  MAX_SERVERS,
  MAX_USERS,
  defaultNumber,
  defaultSpec,
  overrideProblem,
  type DesignSpec,
  type OverrideKey,
  type ServerSize,
} from './spec';

// What the Build panel can change, as pure steps on the spec (docs/milestones/m4-design-v0.md, step 3).

export interface Builder {
  spec: DesignSpec;
  /** The server count to bring back when the load balancer comes back on. */
  serversWithLb: number;
}

export type BuilderChange =
  | { type: 'setLoadBalancer'; on: boolean }
  | { type: 'setServerCount'; count: number }
  | { type: 'setServerSize'; size: ServerSize }
  | { type: 'setCache'; on: boolean }
  | { type: 'setUsers'; users: number }
  /** undefined = back to the default. */
  | { type: 'setOverride'; key: OverrideKey; value: number | undefined };

export const startBuilder = (spec: DesignSpec): Builder => ({
  spec,
  serversWithLb: spec.loadBalancer ? spec.servers.count : defaultSpec.servers.count,
});

const clamp = (value: number, low: number, high: number) =>
  Math.min(high, Math.max(low, Math.round(value)));

export function applyChange(builder: Builder, change: BuilderChange): Builder {
  const { spec } = builder;
  switch (change.type) {
    case 'setLoadBalancer': {
      // No load balancer ⇒ one server: nothing would split the traffic (ADR 0015, spec rule).
      const count = change.on ? builder.serversWithLb : 1;
      return {
        ...builder,
        spec: { ...spec, loadBalancer: change.on, servers: { ...spec.servers, count } },
      };
    }
    case 'setServerCount': {
      if (!spec.loadBalancer) return builder;
      const count = clamp(change.count, 1, MAX_SERVERS);
      return { serversWithLb: count, spec: { ...spec, servers: { ...spec.servers, count } } };
    }
    case 'setServerSize': {
      // Size is the quick knob: picking one replaces a capacity you typed (agreed with Amr).
      const overrides = withoutKey(spec.overrides, 'server.capacity');
      return {
        ...builder,
        spec: { ...spec, servers: { ...spec.servers, size: change.size }, overrides },
      };
    }
    case 'setCache':
      return { ...builder, spec: { ...spec, cache: change.on } };
    case 'setUsers':
      return { ...builder, spec: { ...spec, users: clamp(change.users, 0, MAX_USERS) } };
    case 'setOverride': {
      const { key, value } = change;
      if (value !== undefined && overrideProblem(key, value)) return builder;
      // Typing the default back in is the same as resetting: keep the tag and source it came with.
      const isDefault = value === undefined || value === defaultNumber(spec, key).value;
      const overrides = isDefault
        ? withoutKey(spec.overrides, key)
        : { ...spec.overrides, [key]: value };
      return { ...builder, spec: { ...spec, overrides } };
    }
  }
}

function withoutKey(overrides: DesignSpec['overrides'], key: OverrideKey): DesignSpec['overrides'] {
  return Object.fromEntries(Object.entries(overrides).filter(([name]) => name !== key));
}

/**
 * The new design's world, carrying over what happened live: boxes that stay keep being dead
 * if they were killed, and the users stay where the slider is. Waiting lines carry over on
 * their own, because the engine keeps a box's status when its id stays (replaceWorld).
 */
export function keepLiveState(next: World, current: World): World {
  const wasUp = new Map(
    current.nodes.flatMap((node) => ('up' in node ? [[node.id, node.up] as const] : [])),
  );
  return {
    ...next,
    traffic: { ...next.traffic, users: current.traffic.users },
    nodes: next.nodes.map((node) =>
      'up' in node && wasUp.has(node.id) ? { ...node, up: wasUp.get(node.id) ?? true } : node,
    ),
  };
}
