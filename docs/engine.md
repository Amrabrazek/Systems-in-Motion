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

| Name | Value | Tag | Note |
|---|---|---|---|
| requests per user | 0.1 /s | T | one request every 10 s |
| small server capacity | 80 req/s | T | picked so it breaks near 1,000 users |
| big server capacity | 400 req/s | T | 5× small; real sizes step 2× |
| queueMax | 150 | T | long enough to see the line grow |
| base latency | 50 ms | T | light web request |
| latency bend | ~70–80% busy | R | basic queueing theory |
| "feels slow" line | ~1 s | R | Nielsen response-time limits |

## Smoothing
The engine reports raw numbers. Charts show an exponential moving average (time constant 0.4 s)
computed in `engine/metrics.ts`, so tests and charts agree.

## Later (not M1)
- Multi-hop: λ flows along edges; each box's `served` is the next box's `λ`.
- Load balancer: splits λ across `up` targets (round robin = equal split in flow math).
- Kill node / zone / region: set `up = false` on matching nodes; the split recomputes next step.
- Traffic scripts: `users(t)` instead of a constant.
