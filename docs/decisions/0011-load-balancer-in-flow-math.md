# 0011 Load balancer in flow math: a router with a health-check delay

**Status:** proposed (M2)

```
users ──λ──▶ [LB] ──λ/k──▶ each server it believes is up     (k = believed-up targets)
                 │
                 └─ killed box: still gets λ/k until health checks notice (lb.healthCheckSeconds)
```

**1. Does the LB do work?**

| Option | Pro | Con |
|---|---|---|
| LB is a worker (capacity, queue) | can show "the LB itself breaks" | managed LBs rarely break at these sizes; a red LB would teach the wrong lesson |
| **Router: no capacity, adds `lb.baseLatencyMs` (pick)** | the lesson stays on the servers; tiny engine change | can't show LB overload (Design can add it later as a capacity number) |

**2. How does it split?**

| Option | Pro | Con |
|---|---|---|
| **Equal split = round robin in flow math (pick)** | matches the default; one line of math | uneven servers overload the small one (that's lab 19's lesson) |
| Weighted / least connections | more realistic | a comparison, not M2's lesson |

**3. When does it stop sending to a dead box?**

| Option | Pro | Con |
|---|---|---|
| Instantly | simplest | hides the real error spike every engineer sees after a failure |
| **After `lb.healthCheckSeconds` (pick)** | real behavior; Design can use the real 30–60 s; the number is tagged | one small piece of per-target state (`seenUp`, `changedAt`) |

The LB's view of each target lives in `SimState`, not in the `World`, so a killed box and the
LB's belief about it are separate things. That separation is what makes the error spike.

**Revisit when:** lab 19 (LB algorithms) needs other splits, or Design needs LB limits.
