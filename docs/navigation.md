# Navigation and code split

## Code: shared core + one folder per topic

```
src/
  engine/            shared math (pure TS)           ← changes go in their own PR
  sim/               loop, store, useSim
  kits/
    flow/            stage, dots, queue, box         ← Flow kit UI + model
    data-layout/     (built with SQL vs NoSQL)
  ui/
    shared/          TradeoffCard, Chart, Slider, NumberTag, PageShell, Glossary
    app/             router, Home, NotFound
  design/            Design mode: builder, params panel, breaking point, share
  data/numbers/      teaching.ts · typical.ts · measured.ts   (ADR 0009)
  topics/
    index.ts         registry: id, title, kit, order, status   ← one line per topic
    one-server/      page.tsx · level.ts · content.md · level.test.ts
    load-balancer/
    sql-vs-nosql/    page.tsx · lab.ts · content.md · lab.test.ts
  parts/             deep dives: server.md, load-balancer.md, cache.md …
```

Split by **topic** for content, by **layer** for shared code. Topics may import `engine`,
`sim`, `kits`, `ui/shared`; never another topic (lint rule).

## Pages and routes

```
                ┌────────────────────── #/  Home ──────────────────────┐
                │     [ Learn ]  topic map         [ Design ]  builder │
                └──────┬──────────────────────┬────────────────┬───────┘
                       ▼                      ▼                ▼
          #/learn/one-server     #/learn/sql-vs-nosql      #/design?d=…
          (Level: Play mode)     (Lab: A vs B)             (build, stress, kill, breaking point)
                    │      │
     click a box ───┘      └─── "Next topic" ──▶ #/learn/load-balancer
                    ▼
               #/parts/server   (deep dive, "Go deeper")
```

| Route | Page | Built in |
|---|---|---|
| `#/` | Home: topic map | M1 (one card) |
| `#/learn/:topicId` | Topic page (Level or Lab, from the registry) | M1 (one-server, no Play wrapper yet) |
| `#/parts/:partId` | Deep dive for one part | v1.5 |
| `#/design` | Design mode; `?d=` holds a shared design | M4 |

Every page shares one shell: top bar (Home · Learn · Design) and the M/R/T legend.
Progress (✓ on the map) lives in `localStorage` only. No accounts.

This replaces the brief's "one Playground page" and Sandbox: free building is **Design**, and each
level is its own topic page. A level ends with "Open this in Design" (same world, as a link).

## Routing

Hash URLs (`#/learn/x`) with React Router in hash mode, so it works on GitHub Pages and in PR
preview subfolders. Why: [ADR 0008](decisions/0008-hosting-and-routing.md).

Each topic page is **lazy-loaded**, so adding topic 20 doesn't slow down topic 1.
