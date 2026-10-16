# Engine: how one box behaves

One rule set for every box that does work. Values come from the prototype
([One Box Breaks](https://claude.ai/artifact/AtxvCjqPw1DSvNqLqVCLrc)) and are teaching guesses until we have recorded reality.

```
arrivals λ (req/s) ──▶ [ waiting line (queue) ] ──▶ [ box: capacity c req/s ] ──▶ served
                              │ full?
                              └──▶ dropped (errors)
```

## Each step (dt = 0.05 s)

```
λ            = users × requestsPerUserPerSec          (split across healthy targets downstream)
utilization  = λ / c
queueLength += (λ − c) × dt     → clamp at 0
if queueLength > queueMax:  dropped = overflow / dt,  queueLength = queueMax
latencyMs    = base / (1 − min(utilization, 0.9))     ← waiting rises sharply past ~70–80% [R]
             + queueLength / c × 1000                  ← time spent in line
errorRate    = dropped / λ
```

## Health colors

| Color | Rule |
|---|---|
| green `ok` | utilization < 0.7 |
| yellow `warn` | 0.7 ≤ utilization ≤ 1, and queue under half full |
| red `bad` | utilization > 1, **or** queue over half full |

## Starting numbers (M1)

These live in `src/data/numbers/teaching.ts`, never in engine code (ADR 0009). Design mode uses
`typical.ts` (ranges with citations) and the user's own numbers.


| Name | Value | Tag | Note |
|---|---|---|---|
| requests per user | 0.1 /s | T | one request every 10 s |
| small server capacity | 80 req/s | T | picked so it breaks near 1,000 users |
| big server capacity | 400 req/s | T | 5× small; real sizes step 2× |
| queueMax | 150 | T | long enough to see the line grow |
| base latency | 50 ms | T | light web request |
| latency bend | ~70–80% busy | R | basic queueing theory |
| "feels slow" line | ~1 s | R | Nielsen response-time limits |

## Many boxes (M2)

```
users ──λ──▶ [web] ──served/k──▶ each of its k next boxes ──▶ …
```

- `step()` walks the graph in **flow order** (`engine/graph.ts`): a box runs after every box
  that sends to it, so one pass per step is enough. A cycle or an edge to a missing box throws
  in `createState` (and on `replaceWorld`).
- Users split λ evenly across their edges. A box splits what it **served** evenly across its
  outgoing edges, so an overloaded box shields the boxes after it.
- `errorRate` = drops at every hop / λ. `throughput` = what the last boxes on each path served.
- End-to-end `latencyMs` = a box's own latency + its next hops' latencies, weighted by the
  traffic on each edge (an idle spare box doesn't make the average look better).
  A dead box is left out of the weighting, so latency doesn't look better during an outage.

## Load balancer and kill (M2, ADR 0011)

```
kill B ──▶ B down ──(lb.healthCheckSeconds: LB still sends 1 in k to B, those fail)──▶ LB notices ──▶ split over the rest
```

- `loadBalancer` node: no capacity, adds `lb.baseLatencyMs`, splits evenly across the targets it
  **believes** are up. Beliefs live in `SimState.lbView` (`engine/loadBalancer.ts`), apart from the
  target's real `up`.
- A belief flips only after reality has differed for `lb.healthCheckSeconds` without a break, so a
  box revived inside the window is never marked down, and a revived box waits the window before
  it gets traffic again.
- No target believed up: the LB **fails open** and splits across all of them (as AWS ALB does).
- New targets (more servers) join the split right away. Simplification: real LBs check them first.
- `killNode` / `reviveNode` only accept servers; anything else throws. Killing a box drops its
  waiting line once (counted in `dropped` that step). `errorRate` is capped at 1 for that spike.

## Smoothing
The engine reports raw numbers. Charts show an exponential moving average (time constant 0.4 s)
computed in `engine/metrics.ts`, so tests and charts agree.

## Cache and database (topic 3, ADR 0014)

```
servers ──all requests──▶ [cache] ──misses only──▶ [database]
                             └─ hits stop here (cache latency only)
```

- `database` is a work box with the same math as a server (`db.*` numbers). It can't be killed yet.
- `cache` does no work (no capacity, no queue). Each step it answers `hitRate` of what arrives and
  passes the rest on, split evenly across its outgoing edges.
- `hitRate = rT / (1 + rT) × warmth`, with `r` = requests/s ÷ `cache.keyCount` and `T` = `cache.ttlSeconds`.
- `warmth` (in `SimState.cacheView`) is the share of keys fetched since the cache (re)started:
  each step it grows by `(1 − warmth)(1 − e^(−r·dt))`. A new or revived cache starts at 0, so the
  database takes the full load while it warms up (the stampede).
- A killed cache passes **every** request on and adds no errors; its latency counts as 0.
- `throughput` counts cache hits as finished. End-to-end latency treats hits as paths that stop
  at the cache, so it is `cache + (1 − hitRate) × next hop`.

## Later (not M1)
- Kill zone / region: set `up = false` on matching nodes; the LB notices after its health checks.
- Traffic scripts: `users(t)` instead of a constant.
- Headless runs for Design's breaking point: same `step()`, no drawing, many runs (ADR 0010).
