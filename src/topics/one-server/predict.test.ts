import { describe, expect, it } from 'vitest';
import { nextPredictState, revealLead, startPredict, type PredictState } from './predict';

const waiting: PredictState = { stage: 'waiting', pick: 'slower' };

describe('predict → reveal', () => {
  it('waits for the server to break after a pick', () => {
    expect(nextPredictState(startPredict, { type: 'pick', pick: 'slower', health: 'ok' })).toEqual(
      waiting,
    );
  });

  it('reveals at once if the server is already overloaded when they pick', () => {
    expect(nextPredictState(startPredict, { type: 'pick', pick: 'fails', health: 'bad' })).toEqual({
      stage: 'revealed',
      pick: 'fails',
    });
  });

  it('busy is not enough to reveal; overloaded is', () => {
    expect(nextPredictState(waiting, { type: 'health', health: 'warn' })).toEqual(waiting);
    expect(nextPredictState(waiting, { type: 'health', health: 'bad' })).toEqual({
      stage: 'revealed',
      pick: 'slower',
    });
  });

  it('ignores the server before a pick, and after the reveal', () => {
    expect(nextPredictState(startPredict, { type: 'health', health: 'bad' })).toEqual(startPredict);
    const revealed: PredictState = { stage: 'revealed', pick: 'nothing' };
    expect(nextPredictState(revealed, { type: 'health', health: 'ok' })).toEqual(revealed);
  });

  it('keeps the first answer: a second pick changes nothing', () => {
    expect(nextPredictState(waiting, { type: 'pick', pick: 'fails', health: 'bad' })).toEqual(
      waiting,
    );
  });

  it('try again asks the question again; skip hides it from any stage', () => {
    expect(nextPredictState({ stage: 'revealed', pick: 'fails' }, { type: 'tryAgain' })).toEqual(
      startPredict,
    );
    expect(nextPredictState(waiting, { type: 'skip' })).toEqual({ stage: 'skipped' });
  });

  it('never tells the learner they were wrong', () => {
    for (const pick of ['nothing', 'slower', 'fails'] as const) {
      expect(revealLead(pick).toLowerCase()).not.toMatch(/wrong|incorrect/);
    }
  });
});
