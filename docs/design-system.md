# Design system: "Lab bench"

The look: calm grey-blue panels, one blue accent, traffic-light health colors. Like a clean science lab
where the experiment (the live system) is the only loud thing on screen.

Chosen on 2026-10-13 from three options (Lab bench, Blueprint, Sketchbook). Preview:
[Systems in Motion Looks](https://claude.ai/artifact/9CiYggqconSjyNRUVArUiY).
Why this one: numbers and charts stay easy to read, and the M1 prototype already proved it works.
Borrowed: glowing dots in dark mode (from Blueprint), a hard shadow on the tradeoff card (from Sketchbook).

Tokens live in [`src/ui/shared/tokens.css`](../src/ui/shared/tokens.css). That file is the source of truth
for values; this doc says what each one is for.

## Rules

1. **Tokens only.** No hex colors, font names or pixel spacing outside `tokens.css`.
   Need a new value? Add a token there and a line here.
2. **State is never color alone.** Every health state shows a symbol and a word too (see below).
   About 1 in 12 men can't tell red from green [R].
3. **One accent.** Blue means "you can act here" or "a request". Health colors are not accents.
4. **Numbers in mono, with their tag.** Every number uses `--font-mono` and `tabular-nums`, with its
   M / R / T / U tag beside it (ADR 0009).
5. **Motion explains, never decorates.** Dots, the queue and the overload pulse are the only animations.
   All of them stop under `prefers-reduced-motion`.
6. **Both themes.** Light and dark follow the OS setting. Check both before merging UI.

## Tokens

### Color

| Token | Light | Dark | Used for |
|---|---|---|---|
| `--color-bg` | `#eef1f5` | `#0e131a` | Page background |
| `--color-surface` | `#ffffff` | `#161d27` | Panels, cards, the stage |
| `--color-surface-soft` | `#e6eaf0` | `#1e2733` | Card headers, segmented controls |
| `--color-border` | `#d4dae3` | `#2a3443` | Borders, edges between boxes, idle users |
| `--color-text` | `#16202c` | `#e5eaf1` | Text |
| `--color-text-muted` | `#5b6778` | `#95a1b3` | Labels, captions, AWS tags |
| `--color-accent` | `#2f5bd3` | `#86a2ff` | Primary button, links, request dots, latency line |
| `--color-on-accent` | `#ffffff` | `#0e131a` | Text on the accent |

### Health

One rule set for every box. Thresholds come from [engine.md](engine.md#health-colors).

| State | When | Line + text | Fill | Symbol + word |
|---|---|---|---|---|
| Healthy | utilization < 70% | `--color-ok` | `--color-ok-bg` | ✓ HEALTHY |
| Busy | 70–100%, queue under half full | `--color-warn` | `--color-warn-bg` | ~ BUSY |
| Overloaded | over 100%, or queue over half full | `--color-bad` | `--color-bad-bg` | ! OVERLOADED |

The light-mode health colors are darker than the prototype's so their text passes WCAG AA (4.5:1) on the fill.

### Type

| Token | Face | Used for |
|---|---|---|
| `--font-display` | Bricolage Grotesque 700/800 | Page titles and lesson headings only |
| `--font-body` | IBM Plex Sans 400–600 | Everything else |
| `--font-mono` | IBM Plex Mono 400/500 | Numbers, number tags, AWS tags, small uppercase labels |

Sizes: `--font-size-xs` 12px (tags) · `sm` 14px (captions) · `md` 16px (body) · `lg` 22px (headings) · `xl` 32px (page title).
Fonts load from Google Fonts in `index.html`, with system fallbacks.

### Space, shape, effects

| Token | Value | Used for |
|---|---|---|
| `--space-1` … `--space-5` | 4 · 8 · 16 · 24 · 40 px | Gaps and padding. Use `gap`, not margins |
| `--radius-sm` | 6px | Buttons, number tags |
| `--radius` | 10px | Boxes, panels, cards |
| `--radius-pill` | 999px | Health pill, step chips |
| `--shadow-card` | hard 3px offset | Tradeoff card only |
| `--dot-glow` | none / soft accent glow | Request dots (glows in dark mode only) |

## Core parts

The parts every topic reuses. Build them once in `src/ui/shared/` or the Flow kit, never per topic.

```
 users ●●●  ──●──●──●──▶  ▪▪▪▪  ┌───────────────┐
                          queue │ Server   EC2  │
                                │ ~ BUSY · 85%  │
                                │ ▓▓▓▓▓▓▓▓░░    │
                                └───────────────┘
```

### 1. Box (a part: server, load balancer, cache…)
- Rounded rect, `--radius`, 2px line in the health color, fill in the health `-bg`.
- Inside: name (body, 600), AWS tag top-right (mono, xs, muted), then `symbol STATE · busy %` (mono, health color),
  then a busy bar filled in the health color.
- Overloaded boxes pulse gently (opacity 1 → 0.55, ~1s). No pulse with reduced motion.
- A killed box (M2+): `--color-border` line, dashed, no fill, label `✕ DOWN`, no busy bar. Its why-line pill is `.pill--down` (muted text, dashed outline).
- A router box (load balancer): `--color-text-muted` line, `--color-surface` fill, no health color or bar (it does no work, ADR 0011). Shows "sends to N of M".
- Placement comes from the graph, one column per hop (ADR 0012). Three or more boxes in a column go compact (no note line).

### 2. Request dot
- Circle, r = 4, `--color-accent`, `filter: var(--dot-glow)`.
- Turns `--color-ok` once answered, `--color-bad` and falls away when dropped.
- Dots are a picture of the rates, not the truth. Show "1 dot ≈ N requests" nearby.

### 3. Queue (waiting line)
- Small squares (7px, 1.5px corners) in a row in front of the box, filling right to left.
- `--color-warn` while filling, `--color-bad` when full.

### 4. Health pill + "why" line
- Pill: `--radius-pill`, mono 12px uppercase, health color on health `-bg`, with the symbol.
- Next to it, one plain sentence that says which limit was hit, with the key number in bold:
  "The server is **130% busy** and the waiting line is **full**. New requests are turned away."

### 5. Tradeoff card
- `--color-surface`, 1px `--color-text` border, `--radius`, `--shadow-card`.
- Header in `--color-surface-soft`: "Fix: \<name\>" plus the AWS tag on the right.
- Five rows, always in this order: **Fixes / Cost / Complexity / New risk / Breaks next**.
  Labels are mono, xs, uppercase, muted. Cost is cheap / medium / expensive only.

### 6. Number + tag
- Value in mono with `tabular-nums`, then the tag: a small outlined box with the letter.
- Tag colors: **M** `--color-ok`, **R** `--color-accent`, **T** and **U** `--color-text-muted`.
- Hover or focus shows the note and source.

### 7. Live chart (uPlot)
- Latency line `--color-accent`, errors line `--color-bad`, both with a 12% area fill and a dot on the latest value.
- Grid lines `--color-border`, axis text mono xs muted. Dashed muted line for a threshold (e.g. "~1 s feels slow" [R]).
- Current value big and mono above the chart.

### Buttons
- Primary: accent fill, `--color-on-accent` text. One per panel at most.
- Secondary: surface fill, border, text color.
- Both `--radius-sm`, body 600 at `sm`. Focus ring: 2px accent outline.

## Adding something new

1. Can an existing part or token do it? Use that.
2. If not, add the token to `tokens.css` and the part to this doc in the same PR.
3. Draw it in both themes and in all three health states if it shows health.
