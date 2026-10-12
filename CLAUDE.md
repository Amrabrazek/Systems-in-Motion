# Systems in Motion

A browser playground that teaches system design to beginners by letting them **watch systems
behave live**: add load, see a box turn red, add the part that fixes it, see what breaks next.
Everything is simulated in the browser. There are no real servers.

Planning source of truth: `brief.md` in the planning project. This file is its code-facing mirror.
Design docs: [`docs/`](docs/README.md). Read the relevant one before changing that area.

## Stack
TypeScript (strict) · React + Vite · React Router (hash URLs) · uPlot (charts) · Vitest · ESLint + Prettier · GitHub Pages.
Diagram: plain SVG for now; React Flow only when a milestone needs dragging (ADR 0006, proposed).

## Commands
```
npm run dev        # local dev server
npm test           # vitest (run before every commit)
npm run typecheck  # tsc --noEmit
npm run lint       # eslint, includes the engine import rule
npm run build      # production build (CI runs this)
```

## The one structural rule
```
src/engine/   pure TS. No React, no DOM, no Date.now(), no Math.random().
              step(state, actions, dt) → newState. Seeded RNG only.
src/sim/      the loop: fixed timestep, pause, speed, reset. Owns the store.
src/ui/       reads state and draws it. Sends actions. No sim math here.
src/kits/     shared visual kits (Flow, Data layout, Time & copies, Algorithm).
src/topics/<id>/  one page per topic: level/lab data, page, content, tests.
src/parts/    deep-dive pages (markdown). Routes + full tree: docs/navigation.md
```
- `src/engine` must not import from `ui`, `sim`, `react`, or touch `window`/`document`. Lint enforces it.
- Engine is **flow math** (rates, queues, utilization per box), not one object per request.
- **Dots are a UI-only picture** sampled from engine rates. The engine never knows about dots.
- Every node has `region` and `zone`, even when the UI hides them.
- Topics never import other topics. A new engine/kit feature ships in its own PR before the topic using it.
  Topic list and order: [`docs/roadmap.md`](docs/roadmap.md).
- Change behavior through **actions** (`setUsers`, `killNode`, …), never by mutating state from the UI.

## Testing
- Every engine change ships with Vitest tests. Test behavior, not internals:
  "at 2× capacity, error rate > 0", "below 70% utilization, queue stays 0".
- Same seed + same actions ⇒ same result. Keep tests deterministic; no timers.
- UI: test logic that has branches (selectors, level step machine). Skip snapshot tests.

## Content rules
- Plain language. Any needed term gets a one-line definition.
- Concepts before tools: generic shapes, AWS names as small tags. Never the AWS icon set.
- Every number is tagged: **M** Measured (with source) · **R** Rule of thumb (range) · **T** Teaching guess.
  In code, user-facing numbers use `tagged(value, 'T', 'why')` so the UI can show the tag.
- Cost is relative only: cheap / medium / expensive.
- Every fix shows a tradeoff card: Fixes / Cost / Complexity / New risk / Breaks next.

## Code style
- Small pure functions. Types in `src/engine/types.ts`. No `any`.
- Names a beginner could read: `queueLength`, not `q`; `utilization`, not `rho`.
- No new dependency without saying why in the PR.
- Comments explain *why*, not *what*.

## Current milestone: M1 "One box breaks"
Plan: [`docs/milestones/m1-one-box-breaks.md`](docs/milestones/m1-one-box-breaks.md).
Out of scope for M1: load balancer, levels, Play mode, deep dives, kill buttons, React Flow.

## How to work here
- Start every milestone in **plan mode**; agree steps before code.
- Engine first with tests, then the UI on top.
- One PR per plan step. CI (typecheck, lint, test, build) must be green before merge.
- If a request adds scope beyond the current milestone, say so before doing it.
- Big decision? Add a short ADR in `docs/decisions/` (copy the format of an existing one).
