# Architecture

## Layers

```
            actions (setUsers, killNode, applyFix…)
 ┌────────┐ ─────────────────────────────▶ ┌─────────────┐  step(state, actions, dt)  ┌──────────────┐
 │  ui/   │                                │    sim/     │ ─────────────────────────▶ │   engine/    │
 │ React  │ ◀───── snapshot (~10/s) ────── │ loop + store│ ◀──────── newState ─────── │ pure TS math │
 └───┬────┘                                └──────┬──────┘                            └──────────────┘
     │ every frame (60/s), outside React          │
     └──────── dots + box colors ◀────────────────┘
 topics/  one page each, on shared kits
```

| Layer | Owns | Never does |
|---|---|---|
| `engine/` | Types, `step()`, metrics, seeded RNG | Imports React, reads the clock, draws |
| `sim/` | Fixed-timestep loop, pause/speed/reset, the store, action queue | Sim math |
| `ui/` | Components, SVG stage, dot sampler, charts | Sim math, mutating state |
| `kits/` | Shared visual kits and their models | Topic-specific content |
| `topics/<id>/` | One page: level/lab data, content, tests | Import another topic |
| `design/` | Design mode: builder, params, breaking point, share | Its own sim math |
| `data/numbers/` | Every number, tagged, by profile | Logic |

## One frame

```mermaid
sequenceDiagram
  participant RAF as requestAnimationFrame
  participant Sim as sim loop
  participant Eng as engine.step
  participant Stage as SVG stage (imperative)
  participant React as React panels
  RAF->>Sim: real elapsed time × speed
  loop while accumulator ≥ 50 ms
    Sim->>Eng: step(state, queuedActions, 0.05)
    Eng-->>Sim: newState
  end
  Sim->>Stage: draw boxes, queues, dots (every frame)
  Sim-->>React: publish snapshot (throttled ~10/s)
```

- **Fixed step (50 ms of sim time).** Same seed + same actions = same run, at any speed.
  Slow-mo and 10× just change how many steps run per real second. (ADR 0005)
- **Two render speeds.** The stage redraws every frame without React. React panels
  (charts, "why" line, lesson) re-render ~10 times a second. (ADR 0005)

## Data model (sketch; the real types are in `src/engine/types.ts`)

```ts
type Tag = 'M' | 'R' | 'T' | 'U';   // U = the user's own number (Design)
interface Tagged<T> { value: T; tag: Tag; note: string; source?: string }  // from src/data/numbers (ADR 0009)

type NodeKind = 'users' | 'server' | 'loadBalancer' | 'cache' | 'database';

interface SimNode {
  id: string; kind: NodeKind; label: string; awsTag?: string;  // awsTag: small label, e.g. "EC2"
  capacity: Tagged<number>;       // requests/s it can finish
  queueMax: number;               // waiting line length before it turns requests away
  baseLatencyMs: Tagged<number>;  // time per request when idle
  region: string; zone: string;   // always set; UI hides until a topic needs them
  up: boolean;                    // false = killed
}
interface SimEdge { id: string; from: string; to: string }

interface World {                 // what a level or sandbox starts from
  nodes: SimNode[]; edges: SimEdge[];
  traffic: { users: number; requestsPerUserPerSec: Tagged<number> };
  seed: number;
  rules: ModelRules;              // busy-at 70%, queue-bad fraction, … also tagged numbers
}

interface NodeStatus {            // computed each step
  incoming: number; served: number; dropped: number;   // requests/s
  queueLength: number; utilization: number; latencyMs: number;
  health: 'ok' | 'warn' | 'bad';
}
interface SimState {
  time: number; world: World; rng: RngState;
  nodes: Record<string, NodeStatus>;
  edges: Record<string, { rate: number }>;              // the UI samples dots from this
  totals: { latencyMs: number; errorRate: number; throughput: number };
}

type Action =
  | { type: 'setUsers'; users: number }
  | { type: 'killNode'; id: string }          // M2
  | { type: 'reviveNode'; id: string }        // M2
  | { type: 'replaceWorld'; world: World };   // apply a fix = swap topology
```

Why actions instead of setters: levels, tests, replays and (later) shareable links all become
"a world + a list of actions". (ADR 0005)

**Numbers reach the engine inside the World.** Whoever builds a world (a topic, Design mode)
picks entries from a profile in `src/data/numbers/` and puts the whole entry on the node. The
engine never imports `data/`, so Design can swap in the user's own numbers (tag U) with no
engine change. In code, `Tagged<number>` is `NumberEntry`, and `SimNode` is a union: a
`users` node has no capacity or queue.

## Folder layout

See [navigation.md](navigation.md) for the full tree and the route map.
