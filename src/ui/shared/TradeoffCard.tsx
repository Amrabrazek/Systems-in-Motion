import type { Meter } from './meters';
import { rowText, tradeoffRows, type TradeoffCard as Card } from './tradeoff';
import './TradeoffCard.css';

const STEPS = [1, 2, 3] as const;

/** Shared tradeoff card (design system part 5): Fixes / Cost / Complexity / New risk / Breaks next. */
export function TradeoffCard({
  name,
  awsTag,
  card,
  meters,
}: {
  /** The fix, in plain words: "Load balancer + second server". */
  name: string;
  /** Small concept-to-product hint, e.g. "ELB". Optional: concepts come before tools. */
  awsTag?: string;
  card: Card;
  /** "Right now" strip, recomputed from sim state each frame. Omit for a still card. */
  meters?: readonly Meter[];
}) {
  return (
    <article className="tradeoff" aria-label={`Tradeoffs of the fix: ${name}`}>
      <header className="tradeoff-head">
        <h3 className="tradeoff-name">{`Fix: ${name}`}</h3>
        {awsTag && <span className="tradeoff-aws">{awsTag}</span>}
      </header>
      {meters && meters.length > 0 && <MeterStrip meters={meters} />}
      <dl className="tradeoff-rows">
        {tradeoffRows.map(({ key, label }) => (
          <div className={`tradeoff-row tradeoff-row--${key}`} key={key}>
            <dt>{label}</dt>
            <dd>{rowText(card, key)}</dd>
          </div>
        ))}
      </dl>
    </article>
  );
}

function MeterStrip({ meters }: { meters: readonly Meter[] }) {
  return (
    <section className="tradeoff-meters" aria-label="Right now">
      <h4 className="tradeoff-meters-title">Right now</h4>
      {/* Polite: the words change only when a level does, so this is not chatty. */}
      <ul aria-live="polite">
        {meters.map((meter) => (
          <li className={`meter meter--${meter.look}`} key={meter.label} title={meter.why}>
            <span className="meter-label">
              {meter.label}
              {meter.live && <span className="meter-live">live</span>}
            </span>
            <span className="meter-steps" role="img" aria-label={`${meter.level} of 3`}>
              {STEPS.map((step) => (
                <span
                  key={step}
                  className={step <= meter.level ? 'meter-step is-on' : 'meter-step'}
                />
              ))}
            </span>
            <span className="meter-word">{meter.word}</span>
            {/* Live meters say why in words too: the reason changes, and phones can't hover. */}
            {meter.live && <span className="meter-why">{meter.why}</span>}
          </li>
        ))}
      </ul>
    </section>
  );
}
