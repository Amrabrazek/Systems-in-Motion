import { describe, expect, it } from 'vitest';
import { steps as scaleSteps } from './how-systems-scale/steps';
import { findTopic, topics } from './index';

describe('topic registry', () => {
  it('uses unique, URL-safe ids', () => {
    const ids = topics.map((topic) => topic.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const id of ids) expect(id).toMatch(/^[a-z0-9]+(-[a-z0-9]+)*$/);
  });

  it('finds a topic by id and returns undefined for unknown ids', () => {
    expect(findTopic('one-server')?.title).toBe('One server');
    expect(findTopic('nope')).toBeUndefined();
  });

  // Explainers must link to something live (ADR 0013); a typo would be a dead link.
  it('only links explainer steps to topics that exist', () => {
    for (const step of scaleSteps) {
      if ('topicId' in step.live) expect(findTopic(step.live.topicId), step.id).toBeDefined();
    }
  });
});
