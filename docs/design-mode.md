# Design mode (v1 minimum)

For engineers: "will my design hold, where does it break first, and what does the fix cost?"

v0 cut (what ships first): [milestones/m4-design-v0.md](milestones/m4-design-v0.md).

```
 build ──▶ set traffic ──▶ run ──▶ see bottleneck ──▶ change one thing ──▶ compare to before
   │                          │
   │                          └─▶ kill a server / an AZ: does it survive?
   └─▶ share link (whole design in the URL)
```

## v1: what's in

| Feature | What the engineer does | Engine needs |
|---|---|---|
| **Chain builder** | toggle and size parts in a fixed chain: users → [LB] → servers ×N → [cache] → DB | multi-hop flow (M2) |
| **Parameters** | edit capacity, latency, cache hit rate, read/write mix; each shows its tag; type your own (tag U) | numbers as data (ADR 0009) |
| **Traffic scripts** | steady, morning ramp, spike, viral | `users(t)` |
| **Failure** | kill a server, kill an AZ | `up` flag, region/zone (ADR 0003) |
| **Breaking point** | one click: "breaks at ~4,800 users, first at the DB (connections)" | headless sweep of the engine |
| **Share link** | URL holds the design + traffic | world as data (ADR 0005) |

## Not in v1
| Feature | When | Why wait |
|---|---|---|
| Compare two designs side by side | v1.5 | breaking point + share link cover most of it |
| Free-form canvas (drag any part, any wiring) | later | the fixed chain covers the v1 parts; React Flow returns here (ADR 0006) |
| Real $ cost | later | public pricing is cheap data, but regions and instance types add a lot of UI |
| Measured numbers | later | cited benchmarks first (ADR 0009) |

## Breaking point: how it works
```
for users in 100, 200, 400 … (doubling, then binary search)
  run engine headless for 60 s of sim time with the chosen traffic script
  stop when errorRate > 1% or p99 > target
report: users at break · which box hit its limit first · which limit (CPU, queue, connections)
```
Pure engine + fixed step means this is just a loop: no new architecture.
