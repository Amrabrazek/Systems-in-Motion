import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { TradeoffCard } from './TradeoffCard';
import type { Meter } from './meters';
import { costText, linkForRow, type TradeoffCard as Card } from './tradeoff';

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

describe('tradeoff card meters', () => {
  const meter: Meter = {
    label: 'If 1 server dies',
    level: 3,
    word: '! fails',
    look: 'bad',
    live: true,
    why: 'The others cannot carry its load.',
  };

  it('leaves the card as it was when no meters are given', () => {
    const html = renderToStaticMarkup(<TradeoffCard name="Load balancer" card={card} />);
    expect(html).not.toContain('Right now');
  });

  it('shows each meter with its word, its step count and, when live, why', () => {
    const html = renderToStaticMarkup(
      <TradeoffCard name="Load balancer" card={card} meters={[meter]} />,
    );
    expect(html).toContain('Right now');
    expect(html).toContain('! fails');
    expect(html).toContain('aria-label="3 of 3"');
    expect(html.match(/meter-step is-on/g)).toHaveLength(3);
    expect(html).toContain(meter.why);
  });
});

describe('tradeoff card links to the picture', () => {
  const noop = () => undefined;

  it('links the fix rows and the breaks-next row, never cost or complexity', () => {
    const all = ['fix', 'limit'] as const;
    expect(linkForRow('fixes', all)).toBe('fix');
    expect(linkForRow('newRisk', all)).toBe('fix');
    expect(linkForRow('breaksNext', all)).toBe('limit');
    expect(linkForRow('cost', all)).toBeUndefined();
    expect(linkForRow('complexity', all)).toBeUndefined();
  });

  it('does not link a row when the picture has no box for it', () => {
    expect(linkForRow('breaksNext', ['fix'])).toBeUndefined();
  });

  it('marks and lights only the active link', () => {
    const html = renderToStaticMarkup(
      <TradeoffCard
        name="Read replicas"
        card={card}
        layout="strip"
        link={{ active: 'limit', available: ['fix', 'limit'], onChange: noop }}
      />,
    );
    expect(html).toContain('tradeoff--strip');
    expect(html.match(/is-linked/g)).toHaveLength(1);
    expect(html).toMatch(/tradeoff-row--breaksNext[^"]*is-linked/);
    // The same symbols the boxes use, so the eye can match row to box.
    expect(html).toContain('tradeoff-mark--fix');
    expect(html).toContain('tradeoff-mark--limit');
    expect(html.match(/tabindex="0"/g)).toHaveLength(3);
  });

  it('stays a plain card when the page does not link it', () => {
    const html = renderToStaticMarkup(<TradeoffCard name="Load balancer" card={card} />);
    expect(html).toContain('tradeoff--card');
    expect(html).not.toContain('tabindex');
    expect(html).not.toContain('tradeoff-mark');
  });
});
