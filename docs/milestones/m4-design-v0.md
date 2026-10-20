# M4: Design v0

Status: **agreed with Amr 2026-10-19** (toggles in a fixed chain, not drag; Design before more Learn topics). Model choices: [ADR 0015](../decisions/0015-design-v0-chain-spec.md).
Full v1 feature list: [design-mode.md](../design-mode.md). This doc cuts it down to v0.

## The question v0 answers

> "Will my design hold, and what breaks first?"

```
 pick parts ──▶ size them ──▶ raise users ──▶ see which box turns red
    │              │                │
    │              │                └─▶ kill a server / the cache: does it survive?
    │              └─ every number shows its tag; type your own (tag U)
    └─▶ "Find breaking point" ──▶ "breaks at ~2,400 users, first at the Database (capacity)"
                                     └─▶ copy link: the whole design in the URL
```

## v0 scope

```
users ──▶ [LB] ──▶ servers ×1–8 ──▶ [cache] ──▶ database
          on/off   count + size     on/off       always there
                   (small / big)    + TTL
```

| In v0 | What the engineer does |
|---|---|
| **Chain builder** | toggle LB and cache, set server count (1–8) and size, all in a side panel; the stage redraws (`layoutColumns`, ADR 0012) |
| **Parameters** | click a box: edit its capacity, base latency, waiting line; cache TTL and key count; each number shows its tag, an edit makes it **U**, "reset" brings back the default |
| **Load** | users slider + typed number (Design goes higher than Learn: up to 100,000) |
| **Failure** | kill / revive any server and the cache (engine already supports both) |
| **Breaking point** | one button, runs the engine headless, names the users at break + first box + why |
| **Share link** | `#/design?d=…` holds the design; opening it restores it |
| **Real terms** | RPS, utilization, latency (avg), error rate; each with a one-line hover definition |

Done when:
- [ ] `#/design` builds, runs, kills and finds the breaking point for every chain in the table above
- [ ] Breaking point lights the first box to break on the stage (reuses `FlowStage` `highlight`)
- [ ] A copied link opens the same design in a fresh tab; a broken link opens the default with a notice
- [ ] Engine + spec tests below; Playwright smoke (open Design, add a server, kill one, find breaking point, number shows); CI green
- [ ] Roadmap: Design row status + "Where we are"

## Out of v0 (scope creep, flagged)

| Feature | Goes to | Why wait |
|---|---|---|
| Traffic scripts (ramp, spike, viral) | v1, own engine PR | needs `users(t)` in the engine; steady load + breaking point already answer the v0 question |
| Kill an AZ | v1 | needs zones in the builder + a `killZone` action; every box sits in one zone today |
| Typical numbers (cited ranges, tag R) | v1, own data PR | `typical.ts` is empty and needs research with sources. v0 runs on teaching numbers + your own (U), and says so |
| p99 latency | later | the engine has averages only (flow math, ADR 0002). v0 says "avg", never "p99" |
| Kill the database, read/write mix | topics 8 and 5 | the engine has no writes and no DB failure yet |
| Compare two designs | v1.5 | breaking point + share link cover most of it |
| Free canvas (drag, any wiring) | later | see decision 1 |
| "Open this in Design" from a Level | v1 | easy once the spec exists; Learn worlds aren't specs yet |
| Real $ cost | later | relative cost only (CLAUDE.md) |

⚠️ This makes v0 smaller than the brief's M4 line (which had traffic scripts and kill AZ). Those two
become the first v1 PRs after v0.

## Steps (one PR each)

| # | PR | Contents | Proves |
|---|---|---|---|
| 0 | Plan (this) | this doc, ADR 0015, roadmap | we agree before code |
| 1 | Engine: breaking point | `engine/breakingPoint.ts`: pure `findBreakingPoint(world, options)`; doubling then binary search; break rule below; returns users, first box, reason. Sweep numbers + `server.big.capacity` in `teaching.ts` | headless runs are fast and deterministic |
| 2 | Design spec | `design/spec.ts`: `DesignSpec` type, `defaultSpec`, `specToWorld(spec)` (pure), `encodeSpec` / `decodeSpec` (versioned, validated). No UI. Amr OK'd: no LB ⇒ 1 server; your numbers apply to every server; cache TTL is an override like any number | the URL and the builder share one small shape |
| 3 | Design page: build + run | `#/design`: builder panel, `FlowStage`, users slider, kill / revive, live meters (latency, errors, RPS). Replaces the placeholder. LB off ⇒ 1 server, back on ⇒ your last count; Reset restarts your design; no tradeoff card (no single fix) | it's playable |
| 4 | Parameters panel | click a box → its numbers with tags, edit → U, reset; uses `NumberTag` | engineers can use their own numbers |
| 5 | Breaking point + share | button + result card + highlight on the stage; "Copy link"; load `?d=`; Playwright smoke; roadmap ✅ | the engineer hook works end to end |

```
0 ─▶ 1 ──────────────┐
  └─▶ 2 ─▶ 3 ─▶ 4 ───┴─▶ 5
```
Steps 1 and 2 don't touch the same files and can run in parallel. 4 and 5 both edit the page, so serial.

## Breaking point: the rule

```
users = 100, 200, 400 …   until the design breaks      (doubling)
then binary search between the last good and first bad (~10 more runs)
each run: fresh state, steady users, caches start warm, run 30 s (LB settled), then check
  BREAKS if  any box > 100% utilization      ← it will drop requests, even if the line hasn't filled yet
         or  errorRate > 1%                  ← design.breakErrorRate (T)
         or  avg latency > 1 s               ← ux.feelsSlowMs (R, already in teaching.ts)
report: users at break · first box past its limit · which rule fired
```

Why utilization and not "wait for errors": a box at 101% fills its line slowly (150 places at +1 req/s
≈ 2.5 min), so a short run would miss it. Flow math tells us directly that it will break.
Cost: ~20 runs × ~600 steps of a 6-box world ≈ milliseconds, so it runs on the main thread (no Web Worker).

## Engine and spec tests first

| Given | Expect |
|---|---|
| one small server (80 req/s) | breaks near 800 users, first box = the server, reason = capacity |
| 3 servers, no cache, teaching DB | first box = database |
| same, add warm cache | breaking point goes up; first box changes or users rise |
| same world twice | same result (deterministic) |
| a world that never breaks below the search cap | "holds up to N", no infinite loop |
| `decodeSpec(encodeSpec(s))` | equals `s` for every builder combination |
| a bad / old / hand-edited link | `decodeSpec` returns an error, page falls back to default |
| `specToWorld` | always a valid graph (`createState` doesn't throw), region + zone set on every node |
| user number (U) in a spec | survives the round trip, reaches the world with tag U |

## Open decisions (recommendation first)

1. **Builder: fixed chain on our SVG stage (pick) vs React Flow free canvas.** ADR 0015.
2. **URL holds a small spec (pick) vs the whole World.** ADR 0015.
3. **Break rule includes utilization > 100% (pick) vs errors only.** Above.
4. **v0 runs on teaching numbers (pick) vs fill `typical.ts` first.** Engineers will see T tags
   everywhere, which is honest. Filling typical is research (sources per number), so it gets its own PR.
5. **Check, not decided by Amr yet:** Design v0 before more Learn topics. Recommended, because
   every later Level ends with "open in Design" and Design is the engineer door (ADR 0010).
6. **Cache 2b** (predict question on the Cache page): park it; it doesn't block M4.
