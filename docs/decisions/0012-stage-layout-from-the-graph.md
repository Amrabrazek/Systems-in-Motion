# 0012 The Flow stage lays itself out from the world graph

**Status:** proposed (M2)

M1 drew one hard-coded path. M2 needs 1–4 servers that change while you watch, and Design (M4)
lets the user size the chain. Someone has to place the boxes.

```
column 0     column 1     column 2
 users  ───▶    LB    ──┬▶ server A
                        ├▶ server B
                        └▶ server C      x = hop count from users, y = spread in the column
```

| Option | Pro | Con |
|---|---|---|
| Hand layout per topic (positions in topic data) | prettiest per level | breaks when the server count changes; Design can't use it |
| **Columns by hop count (pick)** | one pure, tested function; works for every chain topic and Design's fixed chain | less control over looks; crossing edges if graphs get odd |
| Graph library (dagre, React Flow) | handles any graph | a dependency for a chain; ADR 0006 keeps React Flow for free-form building |

**Seam:** a topic may pass position overrides by node id if a level needs a special picture.
Not built until one does.

**Revisit when:** Design gets a free-form canvas (ADR 0006).
