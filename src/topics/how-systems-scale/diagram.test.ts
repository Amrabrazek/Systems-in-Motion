import { describe, expect, it } from 'vitest';
import {
  boxRect,
  canvasSize,
  cells,
  describeDiagram,
  partChanges,
  wrapLabel,
  type Diagram,
} from './diagram';

const small: Diagram = {
  parts: [
    { id: 'users', label: 'Users' },
    { id: 'servers', label: 'Server' },
  ],
  edges: [{ from: 'users', to: 'servers' }],
  limit: { part: 'servers', word: 'full' },
};

describe('diagram layout', () => {
  it('turns the grid on its side for narrow screens', () => {
    const wide = boxRect(cells.servers, 'wide');
    const narrow = boxRect(cells.servers, 'narrow');
    // Servers sit right of users when wide, below users when narrow.
    expect(wide.x).toBeGreaterThan(boxRect(cells.users, 'wide').x);
    expect(narrow.y).toBeGreaterThan(boxRect(cells.users, 'narrow').y);
    expect(canvasSize(small, 'wide').width).toBeGreaterThan(canvasSize(small, 'wide').height);
    expect(canvasSize(small, 'narrow').height).toBeGreaterThan(canvasSize(small, 'narrow').width);
  });

  it('draws a bigger box for a scaled-up part, in the same cell', () => {
    const normal = boxRect(cells.servers, 'wide');
    const big = boxRect(cells.servers, 'wide', true);
    expect(big.width).toBeGreaterThan(normal.width);
    expect(big.x + big.width / 2).toBeCloseTo(normal.x + normal.width / 2);
  });

  it('adds a row only when the second region appears', () => {
    const withRegion: Diagram = {
      ...small,
      parts: [...small.parts, { id: 'regionB', label: 'Region B' }],
    };
    expect(canvasSize(withRegion, 'wide').height).toBeGreaterThan(canvasSize(small, 'wide').height);
  });
});

describe('wrapLabel', () => {
  it('wraps at spaces and keeps a long single word whole', () => {
    expect(wrapLabel('Load balancer', 9)).toEqual(['Load', 'balancer']);
    expect(wrapLabel('Load balancer', 14)).toEqual(['Load balancer']);
    expect(wrapLabel('Supercalifragilistic', 5)).toEqual(['Supercalifragilistic']);
  });
});

describe('partChanges', () => {
  it('marks nothing on the first step', () => {
    expect(partChanges(undefined, small).size).toBe(0);
  });

  it('marks added parts as new and edited parts as changed', () => {
    const next: Diagram = {
      ...small,
      parts: [
        { id: 'users', label: 'Users' },
        { id: 'lb', label: 'Load balancer' },
        { id: 'servers', label: 'Servers', copies: 3 },
      ],
    };
    const changes = partChanges(small, next);
    expect(changes.get('lb')).toBe('new');
    expect(changes.get('servers')).toBe('changed');
    expect(changes.has('users')).toBe(false);
  });
});

describe('describeDiagram', () => {
  it('names the parts and the limit in words', () => {
    expect(describeDiagram(small)).toBe('Parts: Users, Server. Limit: Server (full).');
  });
});
