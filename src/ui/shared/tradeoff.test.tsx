import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { TradeoffCard } from './TradeoffCard';
import { costText, type TradeoffCard as Card } from './tradeoff';

const card: Card = {
  fixes: 'One server can not keep up',
  cost: { from: 'cheap', to: 'medium' },
  complexity: 'One new box to run',
  newRisk: 'The load balancer is now in every request',
  breaksNext: 'Lose one server and the other carries everything',
};

function labelsIn(html: string): string[] {
  return [...html.matchAll(/<dt>(.*?)<\/dt>/g)].map((match) => match[1] ?? '');
}

describe('cost text', () => {
  it('shows a single level as one word', () => {
    expect(costText('expensive')).toBe('expensive');
  });

  it('shows a move between levels with an arrow', () => {
    expect(costText({ from: 'cheap', to: 'medium' })).toBe('cheap → medium');
  });

  it('collapses a move to the same level into one word', () => {
    expect(costText({ from: 'medium', to: 'medium' })).toBe('medium');
  });
});

describe('tradeoff card', () => {
  it('always shows the five rows in the fixed order', () => {
    const html = renderToStaticMarkup(<TradeoffCard name="Load balancer" card={card} />);
    expect(labelsIn(html)).toEqual(['Fixes', 'Cost', 'Complexity', 'New risk', 'Breaks next']);
  });

  it('puts each field beside its own label', () => {
    const html = renderToStaticMarkup(<TradeoffCard name="Load balancer" card={card} />);
    expect(html).toContain('<dt>Cost</dt><dd>cheap → medium</dd>');
    expect(html).toContain(`<dt>Breaks next</dt><dd>${card.breaksNext}</dd>`);
  });

  it('names the fix and shows the AWS tag only when given', () => {
    const withTag = renderToStaticMarkup(
      <TradeoffCard name="Load balancer" awsTag="ELB" card={card} />,
    );
    const withoutTag = renderToStaticMarkup(<TradeoffCard name="Load balancer" card={card} />);
    expect(withTag).toContain('>Fix: Load balancer<');
    expect(withTag).toContain('ELB');
    expect(withoutTag).not.toContain('tradeoff-aws');
  });
});
