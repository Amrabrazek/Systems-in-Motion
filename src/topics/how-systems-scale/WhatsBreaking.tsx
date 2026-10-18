import { useState } from 'react';
import { steps } from './steps';
import { stepIndexFor, symptoms } from './symptoms';

/**
 * "What's breaking?" picker: start from the symptom, not from step 1.
 * It only jumps the stepper; the step itself explains the fix and its cost.
 */
export function WhatsBreaking({ onPick }: { onPick: (stepIndex: number) => void }) {
  const [symptomId, setSymptomId] = useState<string>();
  const symptom = symptoms.find((item) => item.id === symptomId);

  return (
    <section className="panel scale-picker" aria-label="What's breaking?">
      <div className="scale-picker-row">
        <h2 className="scale-picker-title">What’s breaking?</h2>
        <ul className="scale-picker-symptoms">
          {symptoms.map((item) => (
            <li key={item.id}>
              <button
                type="button"
                className="scale-step-chip"
                aria-pressed={item.id === symptomId}
                onClick={() => setSymptomId(item.id === symptomId ? undefined : item.id)}
              >
                {item.label}
              </button>
            </li>
          ))}
        </ul>
      </div>
      {symptom && (
        <ul className="scale-picker-fixes">
          {symptom.fixes.map((fix) => {
            const index = stepIndexFor(fix.stepId);
            const step = steps[index];
            if (!step) return null;
            return (
              <li key={fix.stepId}>
                <button type="button" className="button" onClick={() => onPick(index)}>
                  Go to {step.title} →
                </button>
                <span className="muted">Pick when: {fix.pickWhen}</span>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
