# 0003 Every node has region and zone from day one

**Status:** accepted (2026-10-12)

| Option | Pro | Con |
|---|---|---|
| Add later | simpler M1 | rewrite every node and edge later |
| **Model now, hide in UI (pick)** | kill-AZ / kill-region become UI work | two unused fields in M1 |
| World map in v1 | looks great | huge scope jump |

Staging: kill server (M2) → kill AZ (LB topic) → kill region + global users (multi-region topic).
