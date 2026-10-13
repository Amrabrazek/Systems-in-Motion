# 0010 One engine, two doors: Learn and Design

**Status:** accepted (2026-10-13), review after M1
Replaces: "beginners first, engineers later".

```
                ┌─ Learn  : guided levels + labs, plain language        ← students, juniors
shared engine ──┤
                └─ Design : build your system, stress it, kill parts,    ← working engineers
                            find where it breaks, compare designs
```

| Option | Pro | Con |
|---|---|---|
| Beginners only | smallest | not what Amr wants |
| Two separate apps | each one tailored | double the work; numbers drift apart |
| **One engine, two doors (pick)** | Design reuses everything Learn builds; learners graduate into Design | every engine feature must work headless and fast, not only animated |

## What this changes
- **Sandbox becomes Design.** No separate "free sliders" page.
- **Engine must run headless.** Design's "find the breaking point" runs the engine many times
  without drawing. ADR 0005 (pure engine, fixed step) already allows this.
- **Language:** Learn uses plain words. Design uses real terms (p99, utilization, RPS), each with
  a one-line definition on hover.
- **Numbers:** Learn uses teaching numbers; Design uses typical ranges and the user's own (ADR 0009).
