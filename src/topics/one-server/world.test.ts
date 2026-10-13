import { describe, expect, it } from 'vitest';
import { createState, step } from '../../engine';
import { oneServerWorld, START_USERS } from './world';

function after(seconds: number, users: number) {
  let state = createState(oneServerWorld(users));
  for (let i = 0; i < seconds / 0.05; i++) state = step(state, [], 0.05);
  return state.nodes.server;
}

describe('one-server lesson world', () => {
  it('starts healthy, so the first thing a learner sees is calm', () => {
    expect(after(10, START_USERS)?.health).toBe('ok');
  });

  it('breaks somewhere on the slider, near 1,000 users', () => {
    expect(after(20, 700)?.dropped).toBe(0);
    expect(after(20, 1000)?.health).toBe('bad');
  });
});
