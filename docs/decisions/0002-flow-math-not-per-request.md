# 0002 Flow math, with dots as a sampled picture

**Status:** accepted (2026-10-12)

| Option | Pro | Con |
|---|---|---|
| One object per request | exact, easy to reason about | 10k req/s = 10k objects/s; the browser chokes |
| **Rates per box per step (pick)** | scales to millions of "users", cheap, testable | dots aren't the truth |

**Consequence:** the engine outputs rates per edge; the UI spawns ~1 dot per N requests and
says so in the legend. Per-request effects (retry storms, one slow request) get modeled as
rates, or wait for a kit that needs them.
