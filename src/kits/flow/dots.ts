import type { SimEdge, SimState } from '../../engine';
import { stageLayout, type BoxPlace, type Point, type StageLayout } from './layout';

/**
 * Dots are a picture of the engine's rates, not the truth (ADR 0002). Each frame we spawn a few
 * dots in proportion to the request rate and move them edge by edge. At a fork (the load
 * balancer) a dot picks its next edge with the odds the engine's edge rates give, so while the
 * LB hasn't noticed a dead server, dots still go there. A dot reaching a server's waiting line
 * is turned away with the same odds that server drops requests.
 */
export type DotFate = 'flowing' | 'answered' | 'dropped';

/** edge: along an edge · queue: down a waiting line · inside: through a box · exit: off stage. */
export type Leg = 'edge' | 'queue' | 'inside' | 'exit';

export interface Dot {
  id: number;
  x: number;
  y: number;
  startY: number; // spread out where it leaves the users, so dots don't stack
  fate: DotFate;
  leg: Leg;
  at: string; // edge id on an edge leg, else the box id
  progress: number; // 0..1 along the current leg
  fallSpeed: number; // only for dropped dots
  age: number; // seconds since dropped
}

export interface DotField {
  dots: Dot[];
  spawnCredit: number; // fractional dots owed to the next frame
  nextId: number;
  lastTime: number; // sim time of the last update; a jump back means reset
}

// Picture tuning, in stage units and seconds. Not system numbers, so they live here.
const MAX_DOTS_PER_SECOND = 26;
const MIN_DOTS_PER_SECOND = 1.5;
const DOTS_PER_REQUEST = 0.11;
const MAX_DOTS = 220; // one budget for the whole stage, however many edges
const SPEED = 240;
const QUEUE_SLOWDOWN = 6;
const EXIT_SPEED = 300;
const SPREAD = 30;
const GRAVITY = 600;
const DROP_DRIFT = 20;
const DROP_FADE_SECONDS = 0.9;
const LAUNCH_SPEED = -60;
const OFF_STAGE = 10;

export function emptyField(): DotField {
  return { dots: [], spawnCredit: 0, nextId: 0, lastTime: 0 };
}

/** Dots per second drawn for a request rate: grows with load, capped so the stage stays readable. */
export function dotsPerSecond(requestsPerSecond: number): number {
  return Math.min(MAX_DOTS_PER_SECOND, MIN_DOTS_PER_SECOND + requestsPerSecond * DOTS_PER_REQUEST);
}

/** "1 dot ≈ N requests", for the legend. */
export function requestsPerDot(requestsPerSecond: number): number {
  return Math.max(1, Math.round(requestsPerSecond / dotsPerSecond(requestsPerSecond)));
}

/** What a dot needs to know about each server this frame. */
interface BoxOdds {
  dropOdds: number;
  queueFill: number;
}

interface Frame {
  state: SimState;
  layout: StageLayout;
  odds: Map<string, BoxOdds>;
  outgoing: Map<string, SimEdge[]>;
  random: () => number;
}

/** Advance the picture to the sim's current time. `random` is injected so tests are repeatable. */
export function updateDots(field: DotField, state: SimState, random: () => number): DotField {
  if (state.time < field.lastTime) return { ...emptyField(), lastTime: state.time };
  const dt = state.time - field.lastTime;
  if (dt === 0) return field;

  const { world } = state;
  const frame: Frame = {
    state,
    layout: stageLayout(world),
    odds: oddsByBox(state),
    outgoing: new Map(),
    random,
  };
  for (const edge of world.edges) {
    frame.outgoing.set(edge.from, [...(frame.outgoing.get(edge.from) ?? []), edge]);
  }

  const dots: Dot[] = [];
  for (const dot of field.dots) {
    const moved = moveDot(dot, dt, frame);
    if (moved) dots.push(moved);
  }

  const arrivalRate = world.traffic.users * world.traffic.requestsPerUserPerSec.value;
  const usersId = world.nodes.find((node) => node.kind === 'users')?.id;
  let spawnCredit = field.spawnCredit + (arrivalRate > 0 ? dt * dotsPerSecond(arrivalRate) : 0);
  let nextId = field.nextId;
  while (spawnCredit >= 1) {
    spawnCredit -= 1;
    const first = usersId ? pickEdge(frame, usersId) : undefined;
    if (!first || dots.length >= MAX_DOTS) continue;
    const [x, middle] = frame.layout.usersExit;
    const y = middle + (random() - 0.5) * SPREAD;
    dots.push({
      id: nextId++,
      x,
      y,
      startY: y,
      fate: 'flowing',
      leg: 'edge',
      at: first.id,
      progress: 0,
      fallSpeed: 0,
      age: 0,
    });
  }
  return { dots, spawnCredit, nextId, lastTime: state.time };
}

function oddsByBox(state: SimState): Map<string, BoxOdds> {
  const odds = new Map<string, BoxOdds>();
  for (const node of state.world.nodes) {
    if (node.kind !== 'server') continue;
    const status = state.nodes[node.id];
    if (!status) continue;
    odds.set(node.id, {
      // A killed box turns everything away, even before its first step reports it.
      dropOdds: !node.up ? 1 : status.incoming > 0 ? status.dropped / status.incoming : 0,
      queueFill: node.queueMax.value > 0 ? status.queueLength / node.queueMax.value : 0,
    });
  }
  return odds;
}

/** A next edge, with the odds the engine sends traffic down each one. */
function pickEdge(frame: Frame, fromId: string): SimEdge | undefined {
  const out = frame.outgoing.get(fromId) ?? [];
  const rates = out.map((edge) => frame.state.edges[edge.id]?.rate ?? 0);
  const total = rates.reduce((sum, rate) => sum + rate, 0);
  if (total <= 0) return out[Math.floor(frame.random() * out.length)];
  let pick = frame.random() * total;
  for (const [index, edge] of out.entries()) {
    pick -= rates[index] ?? 0;
    if (pick < 0) return edge;
  }
  return out[out.length - 1];
}

/** Start and end of the leg a dot is on, or undefined when its edge or box has gone. */
function legEnds(dot: Dot, frame: Frame): [Point, Point] | undefined {
  const { layout } = frame;
  if (dot.leg === 'edge') {
    const edge = layout.edges[dot.at];
    if (!edge) return undefined;
    return [edge.fromUsers ? [edge.from[0], dot.startY] : edge.from, edge.to];
  }
  const box = layout.boxes[dot.at];
  if (!box) return undefined;
  if (dot.leg === 'queue') return [box.entry, box.door];
  if (dot.leg === 'inside') return [box.door, insideEnd(box, frame)];
  return [center(box), [layout.width + OFF_STAGE, box.centerY]];
}

const center = (box: BoxPlace): Point => [box.x + box.width / 2, box.centerY];

/** A server that answers stops at its centre; anything that forwards goes out its right side. */
function insideEnd(box: BoxPlace, frame: Frame): Point {
  return box.kind === 'server' && !frame.outgoing.has(box.id) ? center(box) : box.exit;
}

function moveDot(dot: Dot, dt: number, frame: Frame): Dot | undefined {
  if (dot.fate === 'dropped') {
    const age = dot.age + dt;
    if (age > DROP_FADE_SECONDS) return undefined;
    const fallSpeed = dot.fallSpeed + GRAVITY * dt;
    return { ...dot, age, fallSpeed, x: dot.x + DROP_DRIFT * dt, y: dot.y + fallSpeed * dt };
  }

  // The waiting line dies with the box (as in the engine): dots in it are turned away.
  if ((dot.leg === 'queue' || dot.leg === 'inside') && frame.odds.get(dot.at)?.dropOdds === 1) {
    return { ...dot, fate: 'dropped', fallSpeed: LAUNCH_SPEED, age: 0 };
  }
  const ends = legEnds(dot, frame);
  if (!ends) return undefined;
  const speed =
    dot.leg === 'queue'
      ? SPEED / (1 + QUEUE_SLOWDOWN * (frame.odds.get(dot.at)?.queueFill ?? 0))
      : dot.leg === 'exit'
        ? EXIT_SPEED
        : SPEED;
  const [[ax, ay], [bx, by]] = ends;
  const progress = dot.progress + (speed * dt) / (Math.hypot(bx - ax, by - ay) || 1);
  if (progress < 1) return at({ ...dot, progress }, ends);

  const next = nextLeg(dot, frame);
  if (!next) return undefined;
  if (next.fate === 'dropped') return next;
  const nextEnds = legEnds(next, frame);
  return nextEnds ? at(next, nextEnds) : undefined;
}

/** What happens when a dot finishes its leg. */
function nextLeg(dot: Dot, frame: Frame): Dot | undefined {
  const fresh = { ...dot, progress: 0 };
  if (dot.leg === 'exit') return undefined;

  if (dot.leg === 'edge') {
    const edge = frame.state.world.edges.find((candidate) => candidate.id === dot.at);
    const box = edge ? frame.layout.boxes[edge.to] : undefined;
    if (!edge || !box) return undefined;
    if (box.kind === 'loadBalancer') return { ...fresh, leg: 'inside', at: box.id };
    if (frame.random() < (frame.odds.get(box.id)?.dropOdds ?? 0)) {
      const [x, y] = box.entry;
      return { ...fresh, x, y, at: box.id, fate: 'dropped', fallSpeed: LAUNCH_SPEED, age: 0 };
    }
    return { ...fresh, leg: 'queue', at: box.id };
  }

  if (dot.leg === 'queue') return { ...fresh, leg: 'inside' };

  // Finished the inside of a box: forward it, or answer it.
  const forward = pickEdge(frame, dot.at);
  if (forward) return { ...fresh, leg: 'edge', at: forward.id };
  return { ...fresh, leg: 'exit', fate: 'answered' };
}

function at(dot: Dot, [[ax, ay], [bx, by]]: [Point, Point]): Dot {
  return { ...dot, x: ax + (bx - ax) * dot.progress, y: ay + (by - ay) * dot.progress };
}
