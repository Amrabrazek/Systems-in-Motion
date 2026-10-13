import { describe, expect, it } from 'vitest';
import type { NodeStatus, NumberEntry, WorkNode } from '../../engine';
import { healthText } from './health';
import { whyLine, whyText } from './why';

const entry = (value: number): NumberEntry => ({ id: 'x', value, unit: '', tag: 'T', note: '' });
const server: WorkNode = {
  id: 'server',
  kind: 'server',
  label: 'Server',
  capacity: entry(80),
  queueMax: entry(150),
  baseLatencyMs: entry(50),
  region: 'r',
  zone: 'z',
  up: true,
};
const status = (overrides: Partial<NodeStatus>): NodeStatus => ({
  incoming: 0,
  served: 0,
  dropped: 0,
  queueLength: 0,
  utilization: 0,
  latencyMs: 50,
  health: 'ok',
  ...overrides,
});

describe('why line', () => {
  it('healthy: says how busy and how fast', () => {
    expect(whyText(whyLine(server, status({ utilization: 0.13, latencyMs: 57 })))).toBe(
      'The server is 13% busy. Each request takes about 57 ms.',
    );
  });

  it('busy: says requests start to wait', () => {
    const text = whyText(
      whyLine(server, status({ utilization: 0.88, latencyMs: 400, health: 'warn' })),
    );
    expect(text).toContain('88% busy');
    expect(text).toContain('wait');
  });

  it('over capacity with room in line: the line is growing', () => {
    const text = whyText(
      whyLine(server, status({ utilization: 1.25, queueLength: 40, health: 'bad' })),
    );
    expect(text).toContain('125% busy');
    expect(text).toContain('growing');
  });

  it('line full: names the dropped rate', () => {
    const parts = whyLine(
      server,
      status({ utilization: 1.25, queueLength: 150, dropped: 20, health: 'bad' }),
    );
    expect(whyText(parts)).toBe(
      'The server is 125% busy and the waiting line is full. 20 requests/s are turned away.',
    );
    expect(parts.filter((part) => part.bold).map((part) => part.text)).toEqual([
      '125% busy',
      'full',
      '20 requests/s',
    ]);
  });

  it('load back under capacity with a backlog: the line is draining', () => {
    const text = whyText(
      whyLine(server, status({ utilization: 0.5, queueLength: 60, latencyMs: 850 })),
    );
    expect(text).toContain('draining');
    expect(text).toContain('850 ms');
  });

  it('shows latency over a second in seconds', () => {
    const text = whyText(
      whyLine(server, status({ utilization: 0.5, queueLength: 100, latencyMs: 2375 })),
    );
    expect(text).toContain('2.4 s');
  });

  it('down: every request is turned away', () => {
    expect(whyText(whyLine({ ...server, up: false }, status({ health: 'bad' })))).toContain('down');
  });
});

describe('health text', () => {
  it('always pairs a symbol with a word', () => {
    expect(healthText('ok')).toBe('✓ HEALTHY');
    expect(healthText('warn')).toBe('~ BUSY');
    expect(healthText('bad')).toBe('! OVERLOADED');
  });
});
