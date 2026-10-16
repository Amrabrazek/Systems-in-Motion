# M3: Level 1 "One server": predict → reveal

Light Play mode (Amr, 2026-10-15). The full Play wrapper is parked at the bottom.

```
Predict card ─▶ learner moves the slider ─▶ server turns red ─▶ Reveal ─▶ Try again / Next: Load balancer →
 (3 choices)       (no auto-ramp)            (first 'bad')       (their pick + why)
```

Guessing before watching is what makes the result stick. That is most of what Play mode teaches,
for about a third of the work.

## Done when
- [x] Card above the stage: "Push the slider to 1,000 users. What happens?" (nothing changes / gets slower / slower, then requests fail)
- [x] The first time the server is overloaded after a pick, the card reveals: their pick next to what happened, why (80 req/s and queue 150, tagged). Never "wrong"
- [x] A pick made while the server is already red reveals at once
- [x] Reveal ends with "Try again" (resets the sim) and "Next: Load balancer →"
- [x] Slider never locks; "Skip" hides the card
- [x] Vitest for the card logic; Playwright: guess, overload, reveal, try again, skip; M1 smokes unchanged

## Decision: topic-local, not shared
| Option | Pro | Con |
|---|---|---|
| Shared `ui/shared/PredictCard` now | Level 2 reuses it | guessing the shape from one example |
| **Inside `topics/one-server/` (pick)** | smallest change; the real shape shows up with Level 2 | one small PR to move it later |

## Parked: full Play mode
Setup → Predict → Run (auto-ramp) → Reveal → Fix (bigger / more / nothing, tradeoff cards) → Twist
(5× server, busy ~4,000, red ~5,000). Needs a `rampUsers` engine action, a shared step machine and
`server.large.capacity` (400 req/s, T). Revisit if learners use the predict card and ask for more.

| Not now | When |
|---|---|
| Predict card on the load balancer page | Level 2; move the card to `ui/shared` then |
| Progress ✓ on Home | with Level 2 |
| "Open in Design" | M4 |
