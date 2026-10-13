import { describe, expect, it } from 'vitest';
import { getNumber } from '../../data/numbers';
import {
  createState,
  step,
  type Action,
  type NodeStatus,
  type NumberEntry,
  type SimState,
  type WorkNode,
  type World,
} from '../../engine';
import { healthText, lookText } from './health';
import { whyForState, whyLine, whyText } from './why';
import { balanced, oneServer } from './worlds.fixture';

const DT = 0.05;

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

describe('why line for a whole stage', () => {
  const run = (world: World, seconds: number, actions: Action[] = []) => {
    let state: SimState = step(createState(world), actions, DT);
    for (let i = 1; i < seconds / DT; i++) state = step(state, [], DT);
    return state;
  };
  const kill = (id: string): Action[] => [{ type: 'killNode', nodeId: id }];
  const healthCheck = getNumber('teaching', 'lb.healthCheckSeconds').value;

  it('one server reads exactly like M1', () => {
    const state = run(oneServer(100), 2);
    const server = state.world.nodes.find((node): node is WorkNode => node.kind === 'server');
    const status = state.nodes.server;
    if (!server || !status) throw new Error('no server');
    expect(whyForState(state)?.parts).toEqual(whyLine(server, status));
  });

  it('names the busiest of several healthy servers by its label', () => {
    const why = whyForState(run(balanced(2, 600), 5));
    expect(whyText(why?.parts ?? [])).toMatch(/^Server [AB] is \d+% busy/);
    expect(why?.look).toBe('ok');
  });

  it('a killed server the LB still believes in: says so and how often', () => {
    const why = whyForState(run(balanced(2, 600), healthCheck / 2, kill('b')));
    expect(whyText(why?.parts ?? [])).toBe(
      "Server B is down. The load balancer hasn't noticed yet, so 1 in 2 requests still go there and are turned away.",
    );
    expect(why?.look).toBe('down');
  });

  it('after the LB notices: names the dead box, then how the survivor copes', () => {
    // 1,000 users on 2 servers: the survivor alone is at 125%.
    const why = whyForState(run(balanced(2, 1000), healthCheck + 6, kill('b')));
    const text = whyText(why?.parts ?? []);
    expect(text).toMatch(/^Server B is down\. Server A is 125% busy/);
    expect(why?.look).toBe('bad');
  });

  it('N+1: a dead box with healthy survivors shows as down, not overloaded', () => {
    const why = whyForState(run(balanced(3, 1000), healthCheck + 6, kill('c')));
    expect(whyText(why?.parts ?? [])).toMatch(/^Server C is down\. Server [AB] is 6\d% busy/);
    expect(why?.look).toBe('down');
  });

  it('every server down: one plain sentence', () => {
    const state = run(balanced(2, 600), 1, [...kill('a'), ...kill('b')]);
    expect(whyText(whyForState(state)?.parts ?? [])).toBe(
      'Every server is down. Every request is turned away.',
    );
  });

  it('a stage with no servers has nothing to explain', () => {
    const world = oneServer(100);
    const usersOnly = { ...world, nodes: world.nodes.slice(0, 1), edges: [] };
    expect(whyForState(createState(usersOnly))).toBeUndefined();
  });
});

describe('box look', () => {
  it('a killed box reads as down, with a symbol', () => {
    expect(lookText('down')).toBe('✕ DOWN');
    expect(lookText('warn')).toBe('~ BUSY');
  });
});
