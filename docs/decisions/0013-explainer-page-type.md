# 0013 Explainer pages: explain simply, interactive only where it helps

**Status:** accepted (2026-10-15)
Replaces: the "Deep dive" page type (a reading page per part).

```
rung 0  static diagram       "here is the shape"
rung 1  step-through         Next / Back moves a diagram one step
rung 2  one-knob widget      one slider or toggle on a small model
rung 3  live sim             embeds a Level or Lab on the engine
Rule: use the lowest rung that makes the idea click.
```

| Option | Pro | Con |
|---|---|---|
| Live sims only | sharpest product | some ideas (consensus, patterns, "how systems scale") don't need a sim and never get covered |
| Explainers as a third door | clear entry for readers | splits Learn; a third nav item for a small page type |
| **Explainer page inside Learn, replaces Deep dive (pick)** | one page type covers part deep dives and concept pages; on-ramp to Levels | risk of becoming one more diagram site |

## Where it sits

```
Explainer ──"try it live"──▶ Level ──"compare"──▶ Lab        (Learn)
                                    └─"build your own"──▶ Design
```

## Rules
- Every explainer links to at least one live Level/Lab, or says why none exists. Explainers are
  glue, not the product: blogs and YouTube already do diagrams well.
- Steps are data (diagram state + caption), drawn by one shared **Stepper** part in `src/ui/shared`.
  The Stepper is built with the first explainer, not before.
- Same content rules as the rest of Learn: plain language, tagged numbers, tradeoff cards on fixes.

## Consequences
- `#/parts/:partId` deep dives become explainers (route decided with the first one).
- First explainer: "How systems scale" (a map of bottleneck → fix → what breaks next, linking each Level). After M3.

**Revisit when:** the first explainer ships; check whether people click through to the live page.
