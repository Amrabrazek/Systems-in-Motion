# Topic backlog (locked 2026-10-15, built later)

Ideas Amr locked so they're picked up when their time comes. Not scheduled; the milestone order
(M3 → M4 → v1) does not change. Source exploration: project file `research/topic-ideas.md`.

Effort: **S** 1 PR, content only · **M** 2–3 PRs on an existing kit · **L** new engine/kit feature (4+ PRs).

## Queued

| Rank | Idea | Page | Kit | Effort | When |
|---|---|---|---|---|---|
| 1 | "How systems scale" | Explainer hub | none (Stepper) | S | after M3 (first explainer, [ADR 0013](decisions/0013-explainer-page-type.md)) |
| 2 | Caching strategies | Level + Lab | Flow + Algorithm | M | with topic 3 (Cache) |
| 3 | Resilience pack | Levels | Flow + retries in engine | L | **v1.5** |
| 4 | Event-driven systems | Level + Lab | Flow (async, pub/sub) + Time & copies | L | with topic 6, after topic 14 |
| 5 | Data patterns pack | Explainer + Labs | Time & copies | L | after topic 14 builds the kit |

### 1. How systems scale (Explainer hub)
Rung-1 map: vertical → horizontal → cache → replicas → sharding → CDN → async → autoscaling →
multi-region. Each step: which bottleneck, which fix, what breaks next, link to its live Level.
Not a new topic: topics 1–13 already are the scaling strategies. Doubles as the Learn front page.

### 2. Caching strategies
- Cache-aside (Level, topic 3): hit-rate slider, DB load drops by the hit rate.
  Twist: cache restarts cold → every request hits the DB at once (stampede).
- Write strategy (Lab): write-through vs write-back vs write-around. Stale value shows live with TTL;
  kill the cache under write-back → writes lost. Winner flips with the read/write mix.
- Eviction (Lab, topic 18): LRU vs LFU, unchanged.

### 3. Resilience pack
Timeouts, retries + backoff/jitter, circuit breaker, bulkhead, load shedding.
Learner sees: one slow DB → clients retry → load triples → everything red (retry storm).
Add jitter → recovers. Add a breaker → the rest stays green.
Engine cost: **retries are a feedback loop** (failed requests return as new load). One engine PR
with tests first; then levels are data. Also what Design users will want ("what if the DB slows down?").

### 4. Event-driven systems
Extends topic 6 (Queues & async):
- Pub/sub fan-out: one slow consumer builds consumer lag while others stay fine.
- Backpressure: unbounded queue vs capped + shedding.
- Dead-letter queue: a poison message blocks a partition until moved aside.
- At-least-once → duplicates → idempotency (topic 15).
- Ordering: per key within a partition, not global.
Needs: Flow async node + topic with N subscribers (lag per consumer); Time & copies for duplicates/ordering.

### 5. Data patterns pack
Saga, outbox, CQRS, event sourcing, leader election, consensus.
Outbox/saga fit Time & copies: crash between "write DB" and "send event" → message lost; add outbox → not lost.
Consensus (Raft) stays an Explainer at rung 1; The Secret Lives of Data already does it well, don't compete.

## Parked (outside this product)

| Idea | Why parked | What would change it |
|---|---|---|
| SOLID | about how **code** changes, not how a running system behaves; no kit applies | a sibling product ("Code in Motion") with a "change ripple" kit: add a feature, see which files must change |
| RAG improvement | changes **answer quality**, not load; showing it honestly needs real models (running cost) or invented scores (breaks ADR 0009) | a cheap rung-0/1 explainer is possible later. "RAG as a system under load" (vector DB latency, token throughput, semantic cache) would fit Flow, but is a different topic |
