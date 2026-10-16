# Systems in Motion

A browser tool where you **watch systems behave live**: add load, see a box turn red, add the
part that fixes it, see what breaks next. One engine, two doors (ADR 0010):
- **Learn**: guided levels and labs for students and junior devs.
- **Design**: engineers build their own system, stress it, kill parts, find where it breaks.
Everything is simulated in the browser. There are no real servers.

Planning source of truth: `brief.md` in the planning project. This file is its code-facing mirror.
Design docs: [`docs/`](docs/README.md). Read the relevant one before changing that area.

## Stack
TypeScript (strict) · React + Vite · React Router (hash URLs) · uPlot (charts) · Vitest + Playwright · ESLint + Prettier · GitHub Pages with PR previews (ADR 0008).
Diagram: plain SVG for now; React Flow only when a milestone needs dragging (ADR 0006).

## Commands
```
npm run dev        # local dev server
npm test           # vitest (run before every commit)
npm run typecheck  # tsc --noEmit
npm run lint       # eslint, includes the engine and topic import rules
npm run format     # prettier (CI runs format:check)
npm run build      # production build (CI runs this)
npm run e2e        # Playwright smoke test against the build
```

## The one structural rule
```
src/engine/   pure TS. No React, no DOM, no Date.now(), no Math.random().
              step(state, actions, dt) → newState. Seeded RNG only.
src/sim/      the loop: fixed timestep, pause, speed, reset. Owns the store.
src/ui/       reads state and draws it. Sends actions. No sim math here.
src/kits/     shared visual kits (Flow, Data layout, Time & copies, Algorithm).
src/topics/<id>/  one page per topic: level/lab data, page, content, tests.
src/design/    Design mode (builder, params, breaking point, share link).
src/data/numbers/  every number, tagged, by profile (teaching / typical / measured).
src/parts/    explainer pages (ADR 0013). Routes + full tree: docs/navigation.md
```
- `src/engine` must not import from `ui`, `sim`, `react`, or touch `window`/`document`. Lint enforces it.
- Engine is **flow math** (rates, queues, utilization per box), not one object per request.
- **Dots are a UI-only picture** sampled from engine rates. The engine never knows about dots.
- Every node has `region` and `zone`, even when the UI hides them.
- **No number literals in the engine.** Capacities, latencies, rates come from `src/data/numbers/` (ADR 0009).
- The engine must run headless (no drawing) and fast: Design runs it many times to find the breaking point.
- Topics never import other topics. A new engine/kit feature ships in its own PR before the topic using it.
  Topic list and order: [`docs/roadmap.md`](docs/roadmap.md).
- Change behavior through **actions** (`setUsers`, `killNode`, …), never by mutating state from the UI.

## Testing
- Every engine change ships with Vitest tests. Test behavior, not internals:
  "at 2× capacity, error rate > 0", "below 70% utilization, queue stays 0".
- Same seed + same actions ⇒ same result. Keep tests deterministic; no timers.
- UI: test logic that has branches (selectors, level step machine). Skip snapshot tests.
- One Playwright smoke test per milestone, run in CI (M1: page loads, raise users, server turns red; M2: kill a server, survivor turns red).
  Engine tests can't catch a blank page.

## Content rules
- Learn: plain language. Design: real terms (p99, RPS). Either way, any term gets a one-line definition.
- Concepts before tools: generic shapes, AWS names as small tags. Never the AWS icon set.
- Every number is tagged: **M** Measured (with source) · **R** Rule of thumb (range, with source) · **T** Teaching guess · **U** the user's own.
  The UI shows the tag beside every number; hover shows the note and source.
- Cost is relative only: cheap / medium / expensive.
- Every fix shows a tradeoff card: Fixes / Cost / Complexity / New risk / Breaks next.

## UI look
- Follow [`docs/design-system.md`](docs/design-system.md) ("Lab bench").
- Colors, fonts, spacing come only from tokens in `src/ui/shared/tokens.css`. No hex values or font names anywhere else.
- Health is never color alone: every state shows a symbol and a word (✓ HEALTHY · ~ BUSY · ! OVERLOADED).
- New token or shared part? Add it to the design system doc in the same PR.

## Code style
- Small pure functions. Types in `src/engine/types.ts`. No `any`.
- Names a beginner could read: `queueLength`, not `q`; `utilization`, not `rho`.
- No new dependency without saying why in the PR.
- Comments explain *why*, not *what*.

## Current milestone: M3 "Level 1: predict → reveal"
Plan: [`docs/milestones/m3-level-1-predict.md`](docs/milestones/m3-level-1-predict.md). M1 and M2 are done.
Light Play mode only: a predict card on the one-server page. Out of scope for M3: auto-ramp, fix/twist steps,
shared Play wrapper, Play on other topics, Design mode.

## How to work here
- Start every milestone in **plan mode**; agree steps before code.
- Engine first with tests, then the UI on top.
- One PR per plan step. CI (typecheck, lint, test, build) must be green before merge.
- If a request adds scope beyond the current milestone, say so before doing it.
- Big decision? Add a short ADR in `docs/decisions/` (copy the format of an existing one).
