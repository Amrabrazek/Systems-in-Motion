# engine/

Pure TS flow math: `step(state, actions, dt) → newState`. No React, no DOM, no clock, no
`Math.random()`, no number literals (numbers come from `src/data/numbers/`). Lint enforces this.
Start at `index.ts`. `step.ts` is the math, `graph.ts` the flow order (and cycle check),
`metrics.ts` the chart smoothing, `rng.ts` the seeded random numbers. See [docs/engine.md](../../docs/engine.md).
