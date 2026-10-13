# sim/

The loop: fixed 50 ms step, accumulator, pause / speed / reset, the store and `useSim`.
Runs outside React (ADR 0005). Start at `index.ts`. `loop.ts` is the loop; `clock.ts` lets tests swap in a fake clock.
