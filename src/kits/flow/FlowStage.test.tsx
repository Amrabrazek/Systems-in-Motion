import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { createState, step, type SimState } from '../../engine';
import { FlowStage } from './FlowStage';
import { cached } from './worlds.fixture';

const run = (state: SimState, seconds: number) => {
  let current = state;
  for (let i = 0; i < seconds / 0.05; i++) current = step(current, [], 0.05);
  return current;
};

describe('stage with a cache and a database (topic 3)', () => {
  it('draws a cold cache as warming up, with a symbol and a word', () => {
    const html = renderToStaticMarkup(<FlowStage state={run(createState(cached(1000)), 1)} />);
    expect(html).toContain('~ WARMING UP');
    expect(html).toContain('Database');
  });

  it('draws a warm cache with how much it answers', () => {
    const html = renderToStaticMarkup(<FlowStage state={run(createState(cached(1000)), 60)} />);
    expect(html).toContain('✓ WARM');
    expect(html).toContain('answers 75% from memory');
  });

  it('draws a dead cache as down and passing everything on', () => {
    const warm = run(createState(cached(1000)), 60);
    const dead = step(warm, [{ type: 'killNode', nodeId: 'cache' }], 0.05);
    const html = renderToStaticMarkup(<FlowStage state={dead} />);
    expect(html).toContain('✕ DOWN');
    expect(html).toContain('passes every request on');
    expect(html).toContain('The cache is down and passes every request on.');
  });
});
