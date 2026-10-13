# 0005 The sim loop lives outside React, with a fixed time step

**Status:** proposed (needs Amr's OK)

This is the decision most likely to hurt later if we get it wrong.

## Where does the running simulation live?

| Option | How | Pro | Con |
|---|---|---|---|
| A. React state | `useState` + `useEffect` timer, React re-renders each tick | familiar, easy to start | 60 renders/s of the whole tree; dots stutter; sim tied to components |
| B. Global store lib (Zustand/Redux) | store holds sim state, components subscribe | devtools, selectors | still pushes 60 updates/s through React; extra dependency |
| **C. Plain store + rAF loop (pick)** | `sim/` owns state; stage draws imperatively every frame; React reads a throttled snapshot via `useSyncExternalStore` | smooth dots, React only redraws panels ~10/s, engine stays testable | two render paths to understand |

```
60/s  sim ──▶ SVG stage (imperative: set attributes, no React)
10/s  sim ──▶ React (charts, "why" line, lesson)
```

## How does time advance?

| Option | Pro | Con |
|---|---|---|
| Variable step (`dt = real elapsed`) | simplest | results change with frame rate; tests flaky; a tab switch = giant jump |
| **Fixed 50 ms step + accumulator (pick)** | same seed ⇒ same run; slow-mo / 10× are just "more or fewer steps" | a little loop code |

## Why actions, not setters
UI sends `{ type: 'setUsers', users }` into a queue the loop applies at the next step.
A run is then *world + seed + action list*, which gives tests, replays, and later shareable
links for free.

**Revisit if:** we add a free-form builder with many interactive panels (then a store library may pay off).
