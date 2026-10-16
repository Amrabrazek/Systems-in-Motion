import type { Health } from '../../engine';

/**
 * Predict → reveal (M3, light Play mode). Guessing before watching is what makes the result
 * stick, so the card asks first and explains only after the learner has seen the server fail.
 * Kept inside this topic until a second level needs it; then it moves to ui/shared.
 */

/** The load the question asks about. Level data, not a model number. */
export const PREDICT_USERS = 1000;

export type Prediction = 'nothing' | 'slower' | 'fails';

export const predictionChoices: { id: Prediction; label: string }[] = [
  { id: 'nothing', label: 'Nothing changes' },
  { id: 'slower', label: 'It gets slower' },
  { id: 'fails', label: 'Slower, then requests fail' },
];

export type PredictState =
  | { stage: 'asking' }
  | { stage: 'waiting'; pick: Prediction } // picked, server not overloaded yet
  | { stage: 'revealed'; pick: Prediction }
  | { stage: 'skipped' };

export type PredictEvent =
  | { type: 'pick'; pick: Prediction; health: Health }
  | { type: 'health'; health: Health }
  | { type: 'tryAgain' }
  | { type: 'skip' };

export const startPredict: PredictState = { stage: 'asking' };

export function nextPredictState(state: PredictState, event: PredictEvent): PredictState {
  switch (event.type) {
    case 'skip':
      return { stage: 'skipped' };
    case 'tryAgain':
      return startPredict;
    case 'pick':
      if (state.stage !== 'asking') return state;
      // Already red when they answer (slider moved first): no reason to make them wait.
      return event.health === 'bad'
        ? { stage: 'revealed', pick: event.pick }
        : { stage: 'waiting', pick: event.pick };
    case 'health':
      // Only "overloaded" settles it: busy alone is "slower", not the whole answer.
      return state.stage === 'waiting' && event.health === 'bad'
        ? { stage: 'revealed', pick: state.pick }
        : state;
  }
}

/** First line of the reveal: their pick next to what happened. Never "wrong". */
export function revealLead(pick: Prediction): string {
  switch (pick) {
    case 'nothing':
      return 'You said nothing changes. The server could not keep up: it got slower, then started turning requests away.';
    case 'slower':
      return 'You said it gets slower. It did, and then it went one step further: requests started failing.';
    case 'fails':
      return 'You said slower, then failing. That is what happened.';
  }
}
