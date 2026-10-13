import { describe, expect, it } from 'vitest';
import { getNumber } from '../../data/numbers';
import { tagTooltip } from './tags';

describe('number tag tooltip', () => {
  it('names the tag and the note for a teaching guess', () => {
    expect(tagTooltip(getNumber('teaching', 'server.small.capacity'))).toMatch(/^Teaching guess: /);
  });

  it('adds the range and the source for a rule of thumb', () => {
    const text = tagTooltip(getNumber('teaching', 'rules.busyAt'));
    expect(text).toContain('Rule of thumb');
    expect(text).toContain('Usual range: 0.7–0.8');
    expect(text).toContain('Source: ');
  });
});
