import { Link } from 'react-router';
import type { NumberEntry } from '../../engine';
import { NumberTag } from '../../ui/shared/NumberTag';
import {
  PREDICT_USERS,
  predictionChoices,
  revealLead,
  type Prediction,
  type PredictState,
} from './predict';
import './predict.css';

interface Props {
  state: PredictState;
  capacity: NumberEntry;
  queueMax: NumberEntry;
  requestsPerUser: NumberEntry;
  onPick(pick: Prediction): void;
  onTryAgain(): void;
  onSkip(): void;
}

const usersText = PREDICT_USERS.toLocaleString('en-US');

export function PredictCard(props: Props) {
  const { state } = props;
  if (state.stage === 'skipped') return null;

  return (
    <section className="panel predict" aria-label="Predict" aria-live="polite">
      {state.stage === 'revealed' ? <Reveal {...props} pick={state.pick} /> : <Ask {...props} />}
    </section>
  );
}

function Ask({ state, onPick, onSkip }: Props) {
  const pick = state.stage === 'waiting' ? state.pick : undefined;
  return (
    <>
      <div className="predict-head">
        <h2>Guess first: push the slider to {usersText} users. What happens?</h2>
        <button className="button button--link" type="button" onClick={onSkip}>
          Skip
        </button>
      </div>
      <div className="predict-choices" role="group" aria-label="Your guess">
        {predictionChoices.map((choice) => (
          <button
            key={choice.id}
            className="button"
            type="button"
            aria-pressed={pick === choice.id}
            disabled={pick !== undefined && pick !== choice.id}
            onClick={() => onPick(choice.id)}
          >
            {choice.label}
          </button>
        ))}
      </div>
      {pick && (
        <p className="muted predict-note">
          Now move the slider up to {usersText} users or more and watch the server.
        </p>
      )}
    </>
  );
}

function Reveal({
  pick,
  capacity,
  queueMax,
  requestsPerUser,
  onTryAgain,
}: Props & { pick: Prediction }) {
  const arriving = PREDICT_USERS * requestsPerUser.value;
  return (
    <>
      <h2>{revealLead(pick)}</h2>
      <p className="predict-why">
        <strong>Why:</strong> the server finishes{' '}
        <NumberTag entry={capacity}>{capacity.value} req/s</NumberTag>. {usersText} users send about{' '}
        <span className="number-value">{arriving} req/s</span>. The extra requests wait in line, so
        every answer takes longer. Once the line is full (
        <NumberTag entry={queueMax}>{queueMax.value}</NumberTag> requests), new ones are turned
        away.
      </p>
      <div className="predict-actions">
        <button className="button" type="button" onClick={onTryAgain}>
          Try again
        </button>
        <Link className="button button--primary" to="/learn/load-balancer">
          Next: Load balancer →
        </Link>
      </div>
    </>
  );
}
