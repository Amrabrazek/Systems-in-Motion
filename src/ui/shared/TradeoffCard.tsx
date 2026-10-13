import { rowText, tradeoffRows, type TradeoffCard as Card } from './tradeoff';
import './TradeoffCard.css';

/** Shared tradeoff card (design system part 5): Fixes / Cost / Complexity / New risk / Breaks next. */
export function TradeoffCard({
  name,
  awsTag,
  card,
}: {
  /** The fix, in plain words: "Load balancer + second server". */
  name: string;
  /** Small concept-to-product hint, e.g. "ELB". Optional: concepts come before tools. */
  awsTag?: string;
  card: Card;
}) {
  return (
    <article className="tradeoff" aria-label={`Tradeoffs of the fix: ${name}`}>
      <header className="tradeoff-head">
        <h3 className="tradeoff-name">{`Fix: ${name}`}</h3>
        {awsTag && <span className="tradeoff-aws">{awsTag}</span>}
      </header>
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
