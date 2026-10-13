# kits/

Shared visual kits: `flow/` (stage, `DotLayer`, queue, box), later `data-layout/`,
`time-and-copies/`, `algorithm/`. See [docs/kits-and-labs.md](../../docs/kits-and-labs.md).
`flow/` today: `layout.ts` places every box from the world graph (one column per hop, ADR 0012);
`FlowStage` draws users, load balancers and servers, each server with its own waiting line;
`whyForState` names the most urgent box; health labels include `✕ DOWN` for a killed box.
`DotLayer` draws request dots every frame, sampled from the engine rates by `dots.ts`: dots walk
edge by edge and pick a branch with the engine's edge-rate odds, so they split at a load balancer.
