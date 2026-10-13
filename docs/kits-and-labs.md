# Visual kits, levels and labs

## 4 kits, one contract

```
               ┌──────────── Playground (Flow kit) ────────────┐
               │  users ──▶ LB ──▶ servers ──▶ cache ──▶ DB     │
               └─────┬────────────────┬──────────────────┬──────┘
           click LB  ▼       click cache ▼         click DB ▼
             Lab: LB algorithms   Lab: eviction      Lab: SQL vs NoSQL
             (Flow kit)           (Algorithm kit)    (Data-layout kit)
```

| Kit | Shows | Example labs | When |
|---|---|---|---|
| **Flow** | boxes + moving dots + queues | one server, LB, retries, queues | M1 |
| **Data layout** | where rows/docs physically sit | SQL vs NoSQL, indexes, sharding | v1 (1 lab) |
| **Time & copies** | copies of data changing over time | replication lag, CAP, idempotency | v1.5 |
| **Algorithm** | one box's internal choice under traffic | rate limiting, cache eviction | v1.5 |

Every kit's model follows the same pure contract, so the sim loop, tests and lab template
work for all of them:

```ts
interface KitModel<State, Action> {
  init(world: unknown, seed: number): State;
  step(state: State, actions: Action[], dt: number): State;
  metrics(state: State): Record<string, number>;  // feeds charts + "why" line
}
```

Rule: a kit is built **when its first lab is built**, not before.

## Level template (Play mode, Flow kit)

```
Setup ─▶ Predict ─▶ Run ─▶ Reveal ─▶ Fix ─▶ Twist ─▶ next level
          (guess)   (ramp)  ("why")   (cards)  (breaks again)
```

```ts
interface Level {
  id: string; title: string;
  start: World;
  steps: LevelStep[];           // setup | predict | run | reveal | fix | twist
  fixes: Fix[];                 // 2–3 options, plus "do nothing"
}
interface Fix { id: string; label: string; world: World; card: TradeoffCard }
type Cost = 'cheap' | 'medium' | 'expensive';
interface TradeoffCard {                    // src/ui/shared/tradeoff.ts
  fixes: string; cost: Cost | { from: Cost; to: Cost };  // { from: 'cheap', to: 'medium' }
  complexity: string; newRisk: string; breaksNext: string;
}
```
Levels are **data**. A level that needs new code means the engine or kit is missing something.

## Lab template (comparisons)

```
1 Question        "Reads are slow. SQL or NoSQL?"
2 Side by side    A | B — same data, same traffic
3 Change one thing slider/button → the winner flips   ← the step that teaches
4 Tradeoff card   Fixes / Cost / Complexity / New risk / Breaks next
5 Rule of thumb   "Pick A when ___, pick B when ___"
```
A lab with no flip in step 3 is not ready; it only shows one side winning.
