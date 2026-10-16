import { describe, expect, it } from 'vitest';
import { isFrame, partChanges } from './diagram';
import { steps } from './steps';

describe('how systems scale: steps', () => {
  it('has unique ids', () => {
    const ids = steps.map((step) => step.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('starts from one server with no fix, and every later step adds a fix', () => {
    expect(steps[0]?.fix).toBeUndefined();
    for (const step of steps.slice(1)) expect(step.fix, step.id).toBeDefined();
  });

  it('only draws edges and limits between parts that are on screen', () => {
    for (const step of steps) {
      const shown = new Set(step.diagram.parts.map((part) => part.id));
      expect(shown.size, `${step.id}: duplicate part`).toBe(step.diagram.parts.length);
      for (const { from, to } of step.diagram.edges) {
        expect(shown.has(from) && shown.has(to), `${step.id}: ${from} → ${to}`).toBe(true);
        expect(isFrame(from) || isFrame(to), `${step.id}: edges join boxes, not frames`).toBe(
          false,
        );
      }
      if (step.diagram.limit) expect(shown.has(step.diagram.limit.part), step.id).toBe(true);
    }
  });

  it('changes the picture on every step, so Next always shows something', () => {
    steps.forEach((step, index) => {
      if (index === 0) return;
      expect(partChanges(steps[index - 1]?.diagram, step.diagram).size, step.id).toBeGreaterThan(0);
    });
  });

  it('keeps numbers out of the tradeoff cards (they belong on the stage, with a tag)', () => {
    for (const step of steps) {
      if (!step.fix) continue;
      const { fixes, complexity, newRisk, breaksNext } = step.fix.card;
      for (const text of [fixes, complexity, newRisk, breaksNext])
        expect(text, step.id).not.toMatch(/\d/);
    }
  });

  it('marks what breaks next on every step', () => {
    for (const step of steps) expect(step.diagram.limit, step.id).toBeDefined();
  });
});
