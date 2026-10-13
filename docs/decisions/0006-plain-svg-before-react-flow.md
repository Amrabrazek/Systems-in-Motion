# 0006 Plain SVG stage now, React Flow only when we need dragging

**Status:** proposed (changes the brief's stack; needs Amr's OK)

M1–M3 have **fixed layouts** that come from level data. The free-form drag-and-drop builder is
on the scope-creep list.

| Option | Pro | Con |
|---|---|---|
| React Flow from M1 (brief) | drag, zoom, edges for free later | ~heavy dependency for one box; its node rendering goes through React, which fights the 60/s stage (ADR 0005) |
| **Own SVG stage now (pick)** | the prototype already proves it; full control of dots and queues; zero dependency | we write layout per level by hand |

**Seam for later:** dots render through one `DotLayer` interface (`draw(dots)`, `clear()`), so a
Canvas layer can replace SVG dots in one file if a topic needs thousands of dots. Boxes stay SVG.

**Revisit when:** Design mode gets a free-form canvas (any part, any wiring). Then React Flow can host
the boxes while our overlay still draws dots.
