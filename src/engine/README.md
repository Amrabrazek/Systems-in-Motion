# engine/

Pure TS flow math: `step(state, actions, dt) → newState`. No React, no DOM, no clock, no
`Math.random()`, no number literals (numbers come from `src/data/numbers/`). Lint enforces this.
Built in M1 step 2. See [docs/engine.md](../../docs/engine.md).
