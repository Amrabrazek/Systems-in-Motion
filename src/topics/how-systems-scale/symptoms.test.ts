import { describe, expect, it } from 'vitest';
import { steps } from './steps';
import { stepIndexFor, symptoms } from './symptoms';

describe('how systems scale: what is breaking?', () => {
  it('points every fix at a real step', () => {
    for (const symptom of symptoms)
      for (const fix of symptom.fixes)
        expect(stepIndexFor(fix.stepId), `${symptom.id} → ${fix.stepId}`).toBeGreaterThan(-1);
  });

  it('offers one or two fixes per symptom, each with a reason to pick it', () => {
    for (const symptom of symptoms) {
      expect(symptom.fixes.length, symptom.id).toBeGreaterThanOrEqual(1);
      expect(symptom.fixes.length, symptom.id).toBeLessThanOrEqual(2);
      for (const fix of symptom.fixes) expect(fix.pickWhen.trim(), symptom.id).not.toBe('');
    }
  });

  it('has unique symptom ids', () => {
    const ids = symptoms.map((symptom) => symptom.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('offers cache or read copies for slow reads, so neither looks required first', () => {
    const reads = symptoms.find((symptom) => symptom.id === 'db-reads');
    expect(reads?.fixes.map((fix) => fix.stepId)).toEqual(['cache', 'read-replicas']);
  });

  it('reaches every step that adds a fix', () => {
    const reached = new Set(symptoms.flatMap((symptom) => symptom.fixes.map((fix) => fix.stepId)));
    for (const step of steps.slice(1)) expect(reached.has(step.id), step.id).toBe(true);
  });

  it('returns -1 for an unknown step', () => {
    expect(stepIndexFor('nope')).toBe(-1);
  });
});
