# 0014 Cache in flow math: a filter whose hit rate comes from TTL

**Status:** accepted (2026-10-16, topic 3)

```
servers ──all reads──▶ [cache] ──misses only──▶ [database]
                          │
                          └─ hits finish here (cache latency only)

hit rate  = r·T / (1 + r·T)        r = reads/s ÷ keyCount,  T = TTL (s)
warm-up   = hit rate × (1 − e^(−r·t))   t = seconds since the cache (re)started
```

**1. Where does the hit rate come from?**

| Option | Pro | Con |
|---|---|---|
| A hit-rate number (slider) | simplest; what the backlog first said | allows impossible combos (TTL 0, 95% hits); can't react to more users; no cold start |
| **Derived from TTL and key count (pick)** | one knob shows the real tradeoff (fresh vs fast); hit rate rises with users; cold start falls out of the same math | one formula to explain; assumes every key equally popular |

The formula is the standard result for a key asked at a steady random rate `r` and kept `T`
seconds (tag R). Real traffic is skewed toward a few hot keys, which hits more, so this is the
cautious side. Design mode may later let users type a hit rate directly (tag U).

**2. Where does the cache sit in the graph?**

| Option | Pro | Con |
|---|---|---|
| Side by side: servers → cache and servers → DB (real cache-aside) | the true picture | a server's outgoing edges carry more than it served; "finished" and latency need special cases |
| **Chain: servers → cache → DB, cache passes on misses (pick)** | same loads and latency as cache-aside; keeps "a box passes on what it served" | the picture is read-through, not cache-aside; the page says so in one line |

**3. Can the cache be the bottleneck?** No capacity, like the LB (ADR 0011). A red cache would
teach the wrong lesson at these sizes. Design can add a capacity number if engineers ask.

**4. What happens when it dies?** It passes **every** read on to the DB and adds no errors: apps
treat a cache error as a miss. On revive (or when first added) it starts empty and warms by the
formula above, so the DB takes the full load for a while: the stampede. No timeout latency is
added for a dead cache (simplification).

**5. Totals.** Hits now finish in the middle of a path, so "finished" = served and not passed on,
and end-to-end latency weights each next hop by the share passed to it. With no cache in the
world this gives exactly the M1/M2 numbers.

**Revisit when:** reads and writes become separate traffic (topic 5), which the write-strategies
lab and a stale-read counter need; or Design needs hot keys or cache limits.
