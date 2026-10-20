# Topic backlog (locked 2026-10-15, built later)

Ideas Amr locked so they're picked up when their time comes. Not scheduled; the milestone order
(M3 → M4 → v1) does not change. Source exploration: project file `research/topic-ideas.md`.

Effort: **S** 1 PR, content only · **M** 2–3 PRs on an existing kit · **L** new engine/kit feature (4+ PRs).

## Queued

| Rank | Idea | Page | Kit | Effort | When |
|---|---|---|---|---|---|
| 1 | "How systems scale" | Explainer hub | none (Stepper) | S | **built** at `#/learn/how-systems-scale` (first explainer, [ADR 0013](decisions/0013-explainer-page-type.md)) |
| 2 | Caching strategies | Level + Lab | Flow + Algorithm | M | Level with topic 3 (Cache); write-strategy Lab after topic 5 |
| 3 | Resilience pack | Levels | Flow + retries in engine | L | **v1.5** |
| 4 | Messaging pack (event-driven) | Levels + Lab | Flow (queue depth, pub/sub) + Time & copies | L | A1 = topic 6; A2–A4 after the resilience pack; duplicates after topic 14 |
| 5 | Data patterns pack | Explainer + Labs | Time & copies | L | after topic 14 builds the kit |
| 6 | Microservices | Levels | Flow (+ calls per request) | M | after the resilience pack and messaging pack |

### 1. How systems scale (Explainer hub)
Rung-1 map: vertical → horizontal → cache → replicas → sharding → CDN → async → autoscaling →
multi-region. Each step: which bottleneck, which fix, what breaks next, link to its live Level.
Not a new topic: topics 1–13 already are the scaling strategies. Doubles as the Learn front page.

### 2. Caching strategies
- Cache-aside (Level, topic 3): TTL slider; the engine derives the hit rate from it
  ([ADR 0014](decisions/0014-cache-in-flow-math.md)), DB load drops by the hit rate.
  Twist: cache restarts cold → every request hits the DB at once (stampede). Plan:
  [milestones/topic-3-cache.md](milestones/topic-3-cache.md).
- Write strategy (Lab): write-through vs write-back vs write-around. Stale value shows live with TTL;
  kill the cache under write-back → writes lost. Winner flips with the read/write mix.
  **Moved after topic 5**: it needs reads and writes as separate traffic (read/write split).
- Eviction (Lab, topic 18): LRU vs LFU, unchanged.

### 3. Resilience pack
Timeouts, retries + backoff/jitter, circuit breaker, bulkhead, load shedding.
Learner sees: one slow DB → clients retry → load triples → everything red (retry storm).
Add jitter → recovers. Add a breaker → the rest stays green.
Engine cost: **retries are a feedback loop** (failed requests return as new load). One engine PR
with tests first; then levels are data. Also what Design users will want ("what if the DB slows down?").

### 4. Messaging pack (event-driven)
Extends topic 6 (Queues & async). One engine piece for all of it: a **queue node whose depth grows
over time** (depth += in − out per tick). Queue depth is the chart engineers watch in production.

```
            ┌─► [queue A] ─► workers A  ✓ fast
[order] ─► (topic) ─► [queue B] ─► workers B  ! slow → lag grows
            └─► [queue C] ─► workers C  ✓
                                 │ fails 3×
                                 ▼
                              [DLQ]
```

| Level | Learner sees | Fix | Breaks next |
|---|---|---|---|
| A1 Queue buffers a spike (= topic 6) | spike → web stays green, queue depth climbs then drains | add workers | never drains if arrival rate > worker rate |
| A2 Fan-out | one event → 3 queues; one slow consumer builds **lag**, others fine | scale that consumer only | cost; ordering |
| A3 Poison message + DLQ | one bad message retried forever, a worker stuck on it | max receives → dead-letter queue | DLQ fills silently, needs an alarm |
| A4 Backpressure | unbounded queue: age of oldest message = hours | cap + shed, or scale workers on queue depth | rejected work |

Later (Time & copies): at-least-once → duplicates → idempotency (topic 15); ordering per key
within a partition, not global.
Labels: topic = SNS / EventBridge, queue = SQS, DLQ = SQS redrive; Kafka only as a tag on "log".

### 5. Data patterns pack
Saga, outbox, CQRS, event sourcing, leader election, consensus.
Outbox/saga fit Time & copies: crash between "write DB" and "send event" → message lost; add outbox → not lost.
Consensus (Raft) stays an Explainer at rung 1; The Secret Lives of Data already does it well, don't compete.

### 6. Microservices
```
Monolith:   [app] ─► [DB]                      1 hop
Split:      [api] ─► [orders] ─► [users] ─► [DB]
                  └► [stock]  ─► [pricing]     latency stacks per hop
```

| Level | Learner sees | Fix | Breaks next |
|---|---|---|---|
| B1 Latency stacks | split the monolith → p99 climbs per hop | parallel calls, fewer hops | complexity |
| B2 Chatty calls | 1 page = 40 calls to `users` → `users` red at low traffic | batch, cache, or merge services | coupling |
| B3 Cascading failure | `pricing` slows → callers wait → `api` red | timeout + circuit breaker (resilience pack) | breaker tuning |
| B4 Independent scaling | only `stock` is hot → scale it alone, cheaper than the whole monolith | (the upside) | more boxes to run |

B3 reuses the resilience pack, so this ships after it. B4 is required: without it the topic only says
"microservices bad", which is wrong. Engine cost is low: Flow already does N hops; it adds
**k calls per request** (fan-out multiplier on an edge).

### Containers: not a topic
Containers change packaging and deploy, which is mostly invisible while the system runs. The parts
that *are* visible live go elsewhere:
- **Cold start** (VM ~60 s, container ~2 s, function fast but cold): twist in topic 4 Autoscaling.
- **Scale workers on queue depth**: messaging Level A4.
- **Noisy neighbor, bin packing** (pods stuck Pending): parked below as one Kubernetes Lab.

## Parked (outside this product)

| Idea | Why parked | What would change it |
|---|---|---|
| SOLID | about how **code** changes, not how a running system behaves; no kit applies | a sibling product ("Code in Motion") with a "change ripple" kit: add a feature, see which files must change |
| RAG improvement | changes **answer quality**, not load; showing it honestly needs real models (running cost) or invented scores (breaks ADR 0009) | a cheap rung-0/1 explainer is possible later. "RAG as a system under load" (vector DB latency, token throughput, semantic cache) would fit Flow, but is a different topic |
| Containers as a topic | packaging/deploy isn't visible at runtime; cold start and queue-based scaling are folded into topic 4 and messaging A4 | a "Kubernetes in motion" Lab: nodes hold pods, one noisy pod slows its neighbors, pods that don't fit stay Pending |
