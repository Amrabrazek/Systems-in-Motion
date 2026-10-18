import { useRef, useState, type KeyboardEvent } from 'react';
import { Link } from 'react-router';
import { TradeoffCard } from '../../ui/shared/TradeoffCard';
import { availableLinks, partChanges, type Link as PartLink } from './diagram';
import { ScaleDiagram } from './ScaleDiagram';
import { moveStep, stepForKey } from './stepper';
import { steps } from './steps';
import { WhatsBreaking } from './WhatsBreaking';
import './page.css';

/**
 * Explainer, rung 1 (ADR 0013): a diagram that grows one fix per step.
 * The steps are a common path, not a rule; the picker lets readers start from what is breaking.
 * The stepper lives here until a second explainer shows what a shared one needs.
 */
export default function HowSystemsScalePage() {
  const [index, setStep] = useState(0);
  // Which row of the strip and which boxes are lit together. A new step starts with nothing lit.
  const [activeLink, setActiveLink] = useState<PartLink>();
  const stepperRef = useRef<HTMLElement>(null);
  const step = steps[index] ?? steps[0];
  if (!step) return null;
  const changes = partChanges(steps[index - 1]?.diagram, step.diagram);
  const links = availableLinks(step.diagram, changes);

  function setIndex(next: number) {
    setStep(next);
    setActiveLink(undefined);
  }
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
        A common path, not a rule. Each step fixes the slowest part, then something else becomes the
        slowest part. Most teams meet these in roughly this order because each step is cheaper than
        the next, but your system follows whatever is breaking.
      </p>

      <WhatsBreaking
        onPick={(next) => {
          setIndex(next);
          // On a phone the stepper is below the fold; bring the step the reader picked into view.
          stepperRef.current?.scrollIntoView({ block: 'start', behavior: 'smooth' });
        }}
      />

      <section
        ref={stepperRef}
        className="panel scale-stepper"
        aria-label="Step through"
        onKeyDown={onKeyDown}
      >
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

        <header className="scale-context">
          <h2>
            {step.title}
            {step.move && <span className="scale-move">{step.move}</span>}
          </h2>
          <p>
            <strong>{isFirst ? 'Where we start: ' : 'The problem: '}</strong>
            {step.problem}
          </p>
          {step.note && (
            <p className="scale-note">
              <strong>Note: </strong>
              {step.note.text}
              {step.note.link && (
                <>
                  {' '}
                  <Link to={`/learn/${step.note.link.topicId}`}>{step.note.link.label} →</Link>
                </>
              )}
            </p>
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
        </header>

        <div className="stage">
          {(['wide', 'narrow'] as const).map((orientation) => (
            <ScaleDiagram
              key={orientation}
              diagram={step.diagram}
              changes={changes}
              orientation={orientation}
              activeLink={activeLink}
              onLink={setActiveLink}
            />
          ))}
        </div>

        {/* The tradeoffs sit inside the panel, under the picture, so the two read as one. */}
        {step.fix && (
          <TradeoffCard
            name={step.fix.name}
            card={step.fix.card}
            layout="strip"
            link={{ active: activeLink, available: links, onChange: setActiveLink }}
            {...(step.fix.awsTag ? { awsTag: step.fix.awsTag } : {})}
          />
        )}

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
    </article>
  );
}
