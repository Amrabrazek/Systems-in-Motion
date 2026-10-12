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
    app/             router, Home, Sandbox, NotFound
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
                     ┌──────────────── #/  Home: topic map ────────────────┐
                     │  path of topics grouped by kit, with ✓ / next / soon │
                     └──────┬──────────────────────┬─────────────────┬──────┘
                            ▼                      ▼                 ▼
               #/learn/one-server     #/learn/sql-vs-nosql      #/sandbox
               (Level: Play mode)     (Lab: A vs B)             (free sliders, all built parts)
                    │      │
     click a box ───┘      └─── "Next topic" ──▶ #/learn/load-balancer
                    ▼
               #/parts/server   (deep dive, "Go deeper")
```

| Route | Page | Built in |
|---|---|---|
| `#/` | Home: topic map | M1 (one card) |
| `#/learn/:topicId` | Topic page (Level or Lab, from the registry) | M1 (one-server, no Play wrapper yet) |
| `#/parts/:partId` | Deep dive for one part | v1 |
| `#/sandbox` | Sandbox | v1 |

Every page shares one shell: top bar (Home · topic title · Sandbox) and the M/R/T legend.
Progress (✓ on the map) lives in `localStorage` only. No accounts.

This replaces the brief's "one Playground page": the Playground becomes **Sandbox**, and each
level is its own topic page.

## Router decision

| Option | Pro | Con |
|---|---|---|
| Normal URLs (`/learn/x`) | clean links | GitHub Pages has no server rewrites: refresh = 404 unless we add a `404.html` redirect hack |
| **Hash URLs (`#/learn/x`) (pick)** | works on GitHub Pages with zero tricks; links still shareable | slightly uglier URLs |

| Option | Pro | Con |
|---|---|---|
| Hand-written router (`hashchange` + switch) | no dependency | we rebuild lazy loading, params, 404 |
| **React Router, hash mode (pick)** | standard; lazy-loads each topic so pages stay small | one dependency |

Each topic page is **lazy-loaded**, so adding topic 20 doesn't slow down topic 1.
**Revisit if:** we move hosting to Netlify/Cloudflare (they support rewrites, so normal URLs become free).
