import { describe, expect, it } from 'vitest';
import { profiles } from './index';

const allEntries = Object.entries(profiles).flatMap(([profile, entries]) =>
  entries.map((entry) => ({ profile, entry })),
);

describe('number profiles (ADR 0009)', () => {
  it('cites a source for every Measured and Rule-of-thumb number', () => {
    const missing = allEntries
      .filter(({ entry }) => (entry.tag === 'M' || entry.tag === 'R') && !entry.source)
      .map(({ profile, entry }) => `${profile}:${entry.id}`);
    expect(missing).toEqual([]);
  });

  it('has unique ids inside each profile', () => {
    for (const entries of Object.values(profiles)) {
      const ids = entries.map((entry) => entry.id);
      expect(new Set(ids).size).toBe(ids.length);
    }
  });
});
