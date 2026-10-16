# Topic 3: Cache

Plan agreed with Amr on 2026-10-16. Model choices: [ADR 0014](../decisions/0014-cache-in-flow-math.md).

## The lesson

```
users ──▶ LB ──▶ 2 servers ──▶ [cache] ──▶ database
                                  │ hit: answer from memory, stop here
                                  └ miss: go on to the database
```

```
1,000 users, no cache  ─▶ servers fine (62%), DATABASE red (166%)     "the DB is the bottleneck now"
add cache, TTL 30 s     ─▶ starts cold: DB stays red ~10–20 s, then hit rate ~75% ─▶ DB green (42%)
double users            ─▶ DB load does NOT double: more users = each key asked more often = more hits
shorten TTL             ─▶ fresher data, fewer hits, DB climbs        (the tradeoff in one knob)
kill cache              ─▶ every read hits the DB ─▶ red             (no errors at the cache itself)
revive cache            ─▶ comes back EMPTY ─▶ DB red until it warms up  (cold start / stampede)
```

Learn sees "the cache hides the database, until it doesn't". Design sees hit rate vs TTL vs
staleness, and that a cache restart is an outage for the DB if the DB can't take full load.

## Key model choice: TTL drives hit rate (not a hit-rate slider)

| Option | Pro | Con |
|---|---|---|
| Hit-rate slider (backlog's idea) | simplest | dishonest combos (TTL 0 + 95% hits); no cold start; hit rate can't react to users |
| **TTL slider, engine derives hit rate (pick)** | one knob shows the real tradeoff (fresh vs fast); hit rate rises with users; cold start falls out of the same math | one formula to explain |

The formula (tag **R**, standard TTL-cache result): a key asked `r` times/s, kept `T` seconds,
hits `rT / (1 + rT)` of the time. `r = read rate / number of keys`. After a restart, the share of
keys already cached is `1 − e^(−r·t)`, so warm-up needs no extra number.
Assumes every key equally popular (real traffic is skewed, which hits more): say so in the note.

Design mode can still type a hit rate directly later (tag U); not in this topic.

## Engine ([ADR 0014](../decisions/0014-cache-in-flow-math.md): cache as a filter in flow math)

| Decision | Pick | Why / alternative |
|---|---|---|
| Shape | chain `servers → cache → db`; cache passes on only misses | real cache-aside is servers → cache + servers → db. Same load and latency numbers; chain keeps "served splits to next hops" unchanged. Picture = read-through |
| Cache capacity | none (router, like the LB in ADR 0011) | a red cache would teach the wrong lesson at this size; Design can add one later |
| Cache down | passes 100% to the DB, no errors | that's what apps do (cache miss on error). Simplification: no timeout latency added |
| Revive / added | starts empty, warms by the formula | the stampede is the main risk lesson |
| Database | new work-node kind `database`, same box math as a server | needed by Design's chain too. Not killable here (topic 8) |
| Totals | "finished" = served and not passed on; latency weights by what each box passes on | hits now finish mid-path. M1/M2 tests must stay identical |

## Stale data (how it looks live)

Level: readout beside the TTL slider: "Users may see answers up to 30 s old" (avg ~TTL/2), plus
the tradeoff card's New risk. No stale-read counter: it needs writes in the engine.

## Steps (one PR each)

| # | PR | Contents |
|---|---|---|
| 0 | Plan | this doc, ADR 0014, roadmap + backlog updates |
| 1 | Engine | `cache` + `database` kinds, TTL hit rate, warm-up state, kill/revive cache, totals generalized; numbers in `teaching.ts` |
| 2 | Flow kit | draw cache + database (symbol + word), hit-rate meter on the cache, dots stop at the cache on hits, why-line for DB/cache |
| 3 | Cache page | `#/learn/cache`: world, TTL slider, kill/revive cache, tradeoff card as `layout="strip"` in the stage panel with `link` (fix = cache box, limit = database box), explainer step flips to the live link, Playwright smoke |

Box highlighting for the strip's `link` on the Flow stage is its own Flow-kit PR from the
tradeoff-strip work (a set of node ids on `FlowStage`). Cache reuses it and does not add it.

Optional 2b (decide after step 3): move PredictCard to `ui/shared` + one question ("double the users: does DB load double?").

## Engine tests first (step 1)

| Given | Expect |
|---|---|
| all M1/M2 tests | unchanged |
| no cache, 1,000 users, DB cap 60 | DB bad, servers ok |
| warm cache, TTL 30 s | DB load = (1 − hit) × reads, DB ok |
| TTL 0 / 0 users | hit rate 0, no NaN |
| more users, same TTL | hit rate goes up |
| kill cache | DB gets 100%, errorRate from the cache = 0 |
| revive cache | hit rate starts 0, rises toward steady |
| latency | = cache + miss share × DB (+ server, LB) |
| same seed + actions twice | identical |

## New numbers (teaching.ts)

| Id | Value | Tag | Note |
|---|---|---|---|
| `db.capacity` | 60 req/s | T | breaks before 2 servers do |
| `db.baseLatencyMs` | 20 ms | T | one indexed query |
| `db.queueMax` | 150 | T | same as server |
| `cache.baseLatencyMs` | 1 ms | R | in-memory stores answer under 1 ms (source added in step 1) |
| `cache.keyCount` | 1,000 | T | distinct things users ask for |
| `cache.ttlSeconds` | 30 s | T | default; slider 0–120 s |

## Not doing (and when)

| Idea | Why not now | When |
|---|---|---|
| Write strategies lab (through / back / around) | needs reads vs writes in the engine | after topic 5 (read/write split) |
| Stale-read counter | needs writes | same lab |
| Skewed popularity (hot keys) | equal popularity is enough here | topic 13 or Design |
| Eviction LRU/LFU | different kit | lab 18 |
| Cache timeout latency, cache capacity | muddies the lesson | Design, if asked |

## Cache before Design v0?
Yes. Design's chain (`users → LB → servers → cache → DB`) needs the cache and database nodes this
topic builds, so Cache first unblocks Design rather than delaying it.
