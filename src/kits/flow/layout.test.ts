import { describe, expect, it } from 'vitest';
import type { World } from '../../engine';
import { layoutColumns, stageLayout } from './layout';
import { STAGE } from './stageMath';
import { balanced, cached, oneServer, server } from './worlds.fixture';

describe('stage layout from the graph (ADR 0012)', () => {
  it('one server sits exactly where M1 drew it', () => {
    const layout = layoutColumns(oneServer(100));
    expect(layout.width).toBe(760);
    expect(layout.height).toBe(290);
    expect(layout.middle).toBe(135);
    const box = layout.boxes.server;
    expect(box?.x).toBe(560);
    expect(box?.centerY).toBe(135);
    expect(box?.entry).toEqual([330, 135]);
    expect(box?.door).toEqual([552, 135]);
    expect(layout.edges['users-server']).toEqual({
      from: [150, 135],
      to: [330, 135],
      fromUsers: true,
    });
  });

  it('puts each hop in its own column, left to right', () => {
    const layout = layoutColumns(balanced(3, 100));
    expect(layout.columns).toEqual([['lb'], ['a', 'b', 'c']]);
    const lb = layout.boxes.lb;
    const a = layout.boxes.a;
    expect(lb && a && lb.exit[0] < a.entry[0]).toBe(true);
    expect(lb && lb.x > STAGE.usersRight).toBe(true);
  });

  it('spreads a column evenly around the middle, top to bottom in world order', () => {
    const layout = layoutColumns(balanced(2, 100));
    const [a, b] = [layout.boxes.a, layout.boxes.b];
    if (!a || !b) throw new Error('missing boxes');
    expect(a.centerY).toBeLessThan(b.centerY);
    expect((a.centerY + b.centerY) / 2).toBeCloseTo(layout.middle);
    expect(layout.boxes.lb?.centerY).toBeCloseTo(layout.middle);
  });

  it('boxes never overlap and stay inside the stage, up to 4 servers', () => {
    for (const count of [1, 2, 3, 4]) {
      const layout = layoutColumns(balanced(count, 100));
      const servers = (layout.columns[1] ?? []).map((id) => layout.boxes[id]);
      servers.forEach((box, index) => {
        if (!box) throw new Error('missing box');
        expect(box.top).toBeGreaterThanOrEqual(0);
        expect(box.top + box.height).toBeLessThanOrEqual(layout.height - STAGE.bottomMargin);
        expect(box.x + box.width).toBeLessThanOrEqual(layout.width);
        const next = servers[index + 1];
        if (next) expect(next.top).toBeGreaterThanOrEqual(box.top + box.height);
      });
    }
  });

  it('makes boxes compact when three or more share a column', () => {
    expect(layoutColumns(balanced(2, 100)).boxes.a?.compact).toBe(false);
    expect(layoutColumns(balanced(3, 100)).boxes.a?.compact).toBe(true);
  });

  it('grows the stage instead of squashing the waiting lines', () => {
    const layout = layoutColumns(balanced(2, 100));
    const a = layout.boxes.a;
    expect(a && a.door[0] - a.entry[0]).toBe(STAGE.queue.track);
    expect(layout.width).toBeGreaterThanOrEqual(STAGE.minWidth);
  });

  it('a later hop sits right of every box that sends to it', () => {
    const world = balanced(2, 100);
    const chained: World = {
      ...world,
      nodes: [...world.nodes, server('db', 'Database')],
      edges: [
        ...world.edges,
        { id: 'a-db', from: 'a', to: 'db' },
        { id: 'b-db', from: 'b', to: 'db' },
      ],
    };
    const layout = layoutColumns(chained);
    expect(layout.columns.map((ids) => ids.length)).toEqual([1, 2, 1]);
    const db = layout.boxes.db;
    expect(db && db.entry[0]).toBeGreaterThan(layout.boxes.a?.exit[0] ?? Infinity);
    expect(layout.edges['a-db']?.from).toEqual(layout.boxes.a?.exit);
  });

  it('gives every edge a start and an end', () => {
    const world = balanced(4, 100);
    const layout = layoutColumns(world);
    for (const edge of world.edges) expect(layout.edges[edge.id]).toBeDefined();
  });

  it('works the layout out once per world', () => {
    const world = balanced(2, 100);
    expect(stageLayout(world)).toBe(stageLayout(world));
  });
});

describe('stage layout with a cache and a database (topic 3)', () => {
  const layout = layoutColumns(cached(1000));

  it('puts the cache after the servers and the database last', () => {
    expect(layout.columns).toEqual([['lb'], ['a', 'b'], ['cache'], ['db']]);
  });

  it('gives the database a waiting line, and the cache none', () => {
    const { cache, db } = layout.boxes;
    expect(cache?.entry).toEqual(cache?.door);
    expect(db && db.entry[0] < db.door[0]).toBe(true);
  });

  it('keeps every box inside the stage', () => {
    for (const box of Object.values(layout.boxes)) {
      expect(box.x + box.width).toBeLessThanOrEqual(layout.width);
    }
  });
});
