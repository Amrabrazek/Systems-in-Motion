import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { createState } from '../../engine';
import { FlowStage } from './FlowStage';
import { pointAfterTap, type StageHighlight } from './highlight';
import { balanced } from './worlds.fixture';

const state = createState(balanced(2, 1000));

describe('stage highlight', () => {
  it('lights only the boxes it names, in its tone', () => {
    const highlight: StageHighlight = { ids: new Set(['lb', 'b']), tone: 'fix' };
    const html = renderToStaticMarkup(<FlowStage state={state} highlight={highlight} />);
    expect(html.match(/is-lit/g)).toHaveLength(2);
    expect(html.match(/flow-box-halo--fix/g)).toHaveLength(2);
    expect(html).not.toContain('flow-box-halo--limit');
  });

  it('draws nothing extra without a highlight', () => {
    const html = renderToStaticMarkup(<FlowStage state={state} />);
    expect(html).not.toContain('is-lit');
    expect(html).not.toContain('flow-box-halo');
  });

  it('ignores ids that are not on the stage', () => {
    const highlight: StageHighlight = { ids: new Set(['cache']), tone: 'limit' };
    const html = renderToStaticMarkup(<FlowStage state={state} highlight={highlight} />);
    expect(html).not.toContain('is-lit');
  });

  it('toggles on tap: a lit box clears, any other box points at itself', () => {
    const highlight: StageHighlight = { ids: new Set(['a']), tone: 'limit' };
    expect(pointAfterTap('a', highlight)).toBeUndefined();
    expect(pointAfterTap('b', highlight)).toBe('b');
    expect(pointAfterTap('a', undefined)).toBe('a');
  });
});
