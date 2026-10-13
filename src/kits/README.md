# kits/

Shared visual kits: `flow/` (stage, `DotLayer`, queue, box), later `data-layout/`,
`time-and-copies/`, `algorithm/`. See [docs/kits-and-labs.md](../../docs/kits-and-labs.md).
`flow/` today: `FlowStage` (users, waiting line, box), the "why" line and health labels.
`DotLayer` draws request dots every frame, sampled from the engine rates by `dots.ts`.
