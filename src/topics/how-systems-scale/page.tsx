import { useState, type KeyboardEvent } from 'react';
import { Link } from 'react-router';
import { TradeoffCard } from '../../ui/shared/TradeoffCard';
import { partChanges } from './diagram';
import { ScaleDiagram } from './ScaleDiagram';
import { moveStep, stepForKey } from './stepper';
import { steps } from './steps';
import './page.css';

/**
 * Explainer, rung 1 (ADR 0013): a diagram that grows one fix per step.
 * The stepper lives here until a second explainer shows what a shared one needs.
 */
export default function HowSystemsScalePage() {
  const [index, setIndex] = useState(0);
  const step = steps[index] ?? steps[0];
  if (!step) return null;
  const changes = partChanges(steps[index - 1]?.diagram, step.diagram);
  const isFirst = index === 0;
  const isLast = index === steps.length - 1;

  function onKeyDown(event: KeyboardEvent) {
    const next = stepForKey(event.key, index, steps.length);
    if (next === undefined) return;
    event.preventDefault();
    setIndex(next);
  }

  return (
    <article className="topic">
      <h1>How systems scale</h1>
      <p className="muted">
        Each step fixes the slowest part. Then something else becomes the slowest part. Step through
        to see the usual order, and what each fix costs.
      </p>

      <section className="panel scale-stepper" aria-label="Step through" onKeyDown={onKeyDown}>
        <ol className="scale-steps">
          {steps.map((item, itemIndex) => (
            <li key={item.id}>
              <button
                type="button"
                className="scale-step-chip"
                aria-current={itemIndex === index ? 'step' : undefined}
                onClick={() => setIndex(itemIndex)}
              >
                <span className="scale-step-number">{itemIndex + 1}</span> {item.title}
              </button>
            </li>
          ))}
        </ol>

        <div className="stage">
          <ScaleDiagram diagram={step.diagram} changes={changes} orientation="wide" />
          <ScaleDiagram diagram={step.diagram} changes={changes} orientation="narrow" />
        </div>

        <div className="panel-row scale-nav">
          <button
            type="button"
            className="button"
            disabled={isFirst}
            onClick={() => setIndex(moveStep(index, -1, steps.length))}
          >
            ← Back
          </button>
          <p className="scale-position" aria-live="polite">
            Step {index + 1} of {steps.length}: <strong>{step.title}</strong>
          </p>
          <button
            type="button"
            className="button button--primary"
            disabled={isLast}
            onClick={() => setIndex(moveStep(index, 1, steps.length))}
          >
            Next →
          </button>
        </div>
      </section>

      <section className="scale-caption" aria-label="This step">
        <h2>
          {step.title}
          {step.move && <span className="scale-move">{step.move}</span>}
        </h2>
        <p>
          <strong>{isFirst ? 'Where we start: ' : 'The problem: '}</strong>
          {step.problem}
        </p>
        {step.fix && (
          <TradeoffCard
            name={step.fix.name}
            card={step.fix.card}
            {...(step.fix.awsTag ? { awsTag: step.fix.awsTag } : {})}
          />
        )}
        <p className="scale-live">
          {'topicId' in step.live ? (
            <Link className="button" to={`/learn/${step.live.topicId}`}>
              ▶ Try it live: {step.live.label}
            </Link>
          ) : (
            <span className="muted">{step.live.comingSoon}</span>
          )}
        </p>
      </section>
    </article>
  );
}
