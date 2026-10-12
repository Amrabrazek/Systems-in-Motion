# 0009 Every number lives in a data file, with its tag and source

**Status:** proposed

Engineers will only trust the results if they can see where each number comes from, and
replace it. Real benchmarks are too expensive now, so the design has to let them drop in later
**without code changes**.

```
src/data/numbers/
  teaching.ts   round numbers that make a lesson visible     (Learn levels)
  typical.ts    rule-of-thumb ranges with citations          (Design defaults)
  measured.ts   empty now; filled later from public or own benchmarks
        │
        ▼  profile picked per page          user overrides (Design only)
   engine reads numbers by id  ◀────────────  "my server does 1,200 req/s"  → tag: yours
```

```ts
interface NumberEntry {
  id: string;                 // 'server.small.capacity'
  value: number; unit: string;
  range?: [number, number];   // for R: the honest spread
  tag: 'M' | 'R' | 'T' | 'U'; // U = the user's own number (Design mode)
  note: string;               // one line: what it assumes
  source?: { title: string; url: string; date: string };  // required for M and R
}
```

| Option | Pro | Con |
|---|---|---|
| Numbers in code (constants) | simplest | changing to Measured = code changes; tags drift from values |
| **Numbers as data with profiles (pick)** | Measured drops in as data; Learn and Design use different sets; users can enter their own | a lookup layer; every number needs an id |
| Fetch numbers from a server | update without deploy | needs a backend; breaks "no servers" |

## Path to Measured, cheapest first
1. **Cited public benchmarks** (vendor docs, published load tests). Cost: cheap. Tag M with source.
2. **User's own numbers** in Design mode. Cost: zero. Tag U. This is often what engineers trust most.
3. **Our own benchmark runs** (k6 against one small server). Cost: medium, one-off. Only if 1 and 2 leave gaps.

## Rules
- Engine never contains a literal capacity, latency or rate. Lint check: no numeric literals in
  `engine/` except 0, 1 and math constants.
- The UI shows the tag next to every number it displays. Hover shows note and source.
