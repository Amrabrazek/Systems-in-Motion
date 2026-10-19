# 0015 Design v0: a fixed chain on the SVG stage, described by a small spec

**Status:** proposed (2026-10-19, M4)

```
DesignSpec (small, versioned)  ──specToWorld──▶  World  ──▶ engine (live or headless)
   │                                               └──▶ FlowStage (layoutColumns)
   └──encode──▶  #/design?d=…   ──decode──▶ DesignSpec
```

**1. How does the engineer build?**

| Option | Pro | Con |
|---|---|---|
| React Flow free canvas | drag any part, any wiring; feels like a real tool | new dependency; its React node rendering fights the 60/s stage (ADR 0005); needs wiring rules ("a cache before a server?"), validation and empty states; 3–4 extra PRs |
| **Fixed chain on our SVG stage (pick)** | `layoutColumns` already draws N servers, cache, DB; zero dependency; every combination is valid by construction | can't build shapes outside the chain (two DBs, a queue) |

The engine already runs any acyclic graph, so a free canvas later is UI work only. The spec
seam keeps that door open: a canvas would write a richer spec, the engine wouldn't change.

**2. What goes in the share link?**

| Option | Pro | Con |
|---|---|---|
| The whole `World` as JSON | no extra type | long URLs (every number carries its note and source); breaks whenever a type changes; trusts whatever is in the URL |
| **A small `DesignSpec` (pick)** | short URL; `v: 1` lets old links keep working; only user-changed numbers are stored, defaults come from `data/numbers` | one more type and one pure function (`specToWorld`) to test |

Compression (e.g. lz-string) is not needed: a spec is a few hundred characters. Revisit if a canvas spec gets long.

## Consequences
- `src/design/` owns the spec, the page and the panels. It never does sim math (CLAUDE.md).
- The breaking point search is pure and lives in `src/engine/`, so Learn pages can show
  "this design breaks at ~N" later without importing Design.
- ADR 0006 and 0012 stay as they are: their "revisit when Design gets a free-form canvas" is still later.

**Revisit when:** a topic needs a shape the chain can't express (queues, read replicas, multi-region).
