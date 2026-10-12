# 0001 Simulate in the browser, don't host real servers

**Status:** accepted (2026-10-12)

| | Simulation (pick) | Real servers |
|---|---|---|
| Cost | cheap: static site | expensive: per learner |
| Feedback | instant, can fast-forward | slow: boots take ~1–5 min [R] |
| Repeatable | yes | no (noise, cold starts) |
| Failures | any, one flag | region failure can't be faked cheaply |
| Risk | model can be "wrong" | bill shock, abuse as a DDoS tool |

**Why:** the goal is intuition, not benchmarks.
**Later:** "recorded reality" (run real benchmarks once, ship results as **M** numbers) and a
local `docker compose` lab.
