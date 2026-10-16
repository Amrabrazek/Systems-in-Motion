# Roadmap: topics as independent pages

## Where we are (updated by every PR)

```
Done:  M1 one box breaks · M2 load balancer + kill · M3 predict → reveal · "How systems scale" explainer
Now:   tradeoff strip in the stage panel (explainer + Load balancer done; Flow kit box highlight next)
Next:  topic 3 Cache (plan agreed, ADR 0014) ─▶ step 1 engine
Then:  M4 Design v0
```

Rule: every PR that finishes or starts something updates this block and the **Status** column below,
so "what is next?" is answered by this file.

Each topic is **one page** in its own folder. Topics never import each other, so several can be
built at the same time. They are **not** fully independent though: they share the engine and a
visual kit. That shared part is built first, then the work fans out.

## What must exist before going parallel

```mermaid
flowchart TD
  F0["Foundation (serial)<br/>scaffold + CI · engine core · sim loop<br/>SVG stage · charts · tradeoff card · topic page shell"]
  F0 --> FL["Flow kit: multi-hop + split + kill<br/>(built with Load balancer)"]
  F0 --> DL["Data-layout kit<br/>(built with SQL vs NoSQL)"]
  F0 --> TC["Time & copies kit<br/>(built with Replication lag)"]
  F0 --> AL["Algorithm kit<br/>(built with Rate limiting)"]
  FL --> A1[Cache] & A2[Autoscaling] & A3[Read replicas] & A4[Queues & async] & A5[CDN & files] & A6[Failure & backups]
  A6 --> A7[Multi-region] --> A8[DR lab]
  DL --> B1[Indexes] & B2[Sharding & hot keys]
  TC --> C1[Exact data / money] & C2[Consistency & CAP]
  AL --> D1[Cache eviction] & D2[LB algorithms]
```

```
Serial:    Foundation ──▶ first topic of each kit (builds the kit)
Parallel:  4 kit lanes run side by side; inside a lane, most topics run side by side too
```

## Topic list

Page types: **Level** = Play mode (predict → break → fix), **Lab** = A vs B comparison,
**Explainer** = explain simply, interactive only where it helps ([ADR 0013](decisions/0013-explainer-page-type.md)).

| # | Topic | Page | Kit | Engine/kit feature it adds | Can start after | Status |
|---|---|---|---|---|---|---|
| 1 | One server | Level | Flow | single box (M1) | Foundation | ✅ done (M1, M3) |
| 2 | Load balancer (+ kill server, kill AZ) | Level | Flow | multi-hop, split, `up` flag | 1 | ✅ done (M2; tradeoff strip) |
| 3 | Cache | Level | Flow | cache + database nodes, hit rate from TTL ([plan](milestones/topic-3-cache.md)) | 2 | 🛠 plan agreed |
| 4 | Autoscaling | Level | Flow | capacity over time, boot lag | 2 | |
| 5 | Read replicas | Level | Flow | read/write split | 2 | |
| 6 | Queues & async jobs | Level | Flow | async node (user doesn't wait) | 2 | |
| 7 | CDN & files | Level | Flow | edge cache by region | 2 | |
| 8 | Failure & backups | Level | Flow | kill + restore with data loss | 2 | |
| 9 | Multi-region (+ global users, kill region) | Level | Flow | user groups, distance latency | 8 | |
| 10 | DR ladder (RTO/RPO) | Lab | Flow | recovery timeline | 9 | |
| 11 | SQL vs NoSQL | Lab | Data layout | builds the kit | Foundation | |
| 12 | Indexes | Lab | Data layout | rows-scanned counter | 11 | |
| 13 | Sharding & hot keys | Lab | Data layout | keys → shards | 11 | |
| 14 | Replication lag | Lab | Time & copies | builds the kit | Foundation | |
| 15 | Exact data (money, idempotency) | Lab | Time & copies | retries + duplicate detection | 14 | |
| 16 | Consistency & CAP | Lab | Time & copies | partitions | 14 | |
| 17 | Rate limiting | Lab | Algorithm | builds the kit | Foundation | |
| 18 | Cache eviction (LRU vs LFU) | Lab | Algorithm | eviction policies | 17 | |
| 19 | LB algorithms | Lab | Algorithm (+ Flow) | per-server speed | 2, 17 | |
| 20 | Outside services, Cost | Explainer | none | none | anytime | |
| E1 | How systems scale | Explainer | none (Stepper) | none | anytime | ✅ done (tradeoff strip + links) |
| D | Design mode | Tool | Flow | headless sweep, `users(t)`, URL encoding | 2 | |

## v1: the smallest version that serves both audiences

```
Learn   levels 1–3 (one server, load balancer, cache) + 1 lab (SQL vs NoSQL)
Design  chain builder · parameters with tags · traffic scripts · kill server/AZ
        · breaking point · share link            (see design-mode.md)
```

| Change vs the old v1 | Why |
|---|---|
| ➕ Design mode (about 4 PRs) | the engineer door (ADR 0010) |
| ➖ Sandbox | Design replaces it |
| ➖ Explainer per part → v1.5 | pays for Design. v1 keeps a one-line definition + glossary per part |
| ➖ Compare mode → v1.5 | breaking point + share link cover most of it |

⚠️ Net: v1 is still bigger than before. Design is the part to cut further if v1 drags.
The rest of the topic list is the queue, not a promise.

## Milestones

```
M1 One box breaks  ─▶ M2 Load balancer + kill ─▶ M3 Level 1 (Play) ─▶ M4 Design v0 ─▶ v1
   (shared engine)     (multi-hop, numbers data)                        (builder, breaking point, share)
   ✅ done              ✅ done                     ✅ done (light)        ○ after Cache
```

## How parallel work stays safe

```
src/topics/<topic-id>/   page.tsx · level.ts or lab.ts · content.md · *.test.ts
        │ may import
        ▼
src/kits/<kit>/   src/engine/   src/ui/shared/        ✗ never another topic
```

1. **Shared code lands first, alone.** A topic that needs a new engine or kit feature ships that
   feature as its own small PR (with tests). Then the topic page is built on top. This keeps two
   parallel topics from editing the same engine file at the same time.
2. **One registry line per topic.** `src/topics/index.ts` lists topics. It's the only shared
   file a topic PR touches.
3. **Lint rule:** no imports between topic folders.
4. **One topic = one branch = one thread/session.**

See [ADR 0007](decisions/0007-topics-as-isolated-pages.md) for why.

## After this list

Locked ideas waiting their turn (caching strategies, resilience pack for v1.5, event-driven,
data patterns, "How systems scale" explainer) and parked ones (SOLID, RAG): [topic-backlog.md](topic-backlog.md).
