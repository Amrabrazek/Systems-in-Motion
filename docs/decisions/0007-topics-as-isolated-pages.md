# 0007 Topics are isolated pages on shared kits

**Status:** accepted (2026-10-13), review after M1

| Option | Pro | Con |
|---|---|---|
| One big app, topics as levels in one runner | maximum reuse | every topic edits the same files, so parallel work collides |
| Fully standalone mini-app per topic | perfectly parallel | duplicated engines; topics drift apart in look and numbers |
| **Topic folders on shared engine + kits (pick)** | topics build in parallel; consistent look and math | shared features must land first, which is a small serial step |

**Rule:** topics import from `engine/`, `kits/`, `ui/shared/`, and never from each other.
New shared behavior goes in its own PR before the topic that needs it.
