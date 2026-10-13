import type { SimState, WorkNode } from '../../engine';
import { STAGE } from './stageMath';

/**
 * Dots are a picture of the engine's rates, not the truth (ADR 0002). Each frame we spawn a few
 * dots in proportion to the request rate and move them along the stage. A dot reaching the
 * waiting line is turned away with the same odds the engine drops requests.
 */
export type DotFate = 'flowing' | 'answered' | 'dropped';

export interface Dot {
  id: number;
  x: number;
  y: number;
  startY: number; // spread out where it leaves the users, so dots don't stack
  fate: DotFate;
  segment: number; // index into the path
  progress: number; // 0..1 along the current segment
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
const MAX_DOTS = 220;
const SPEED = 240;
const QUEUE_SLOWDOWN = 6;
const EXIT_SPEED = 300;
const SPREAD = 30;
const GRAVITY = 600;
const DROP_DRIFT = 20;
const DROP_FADE_SECONDS = 0.9;
const LAUNCH_SPEED = -60;

const QUEUE_END = STAGE.box.x - 8;
const BOX_CENTER = STAGE.box.x + STAGE.box.width / 2;
const EXIT = STAGE.width + 10;
// Segments: users → line start → line end (box door) → box centre → exit.
const QUEUE_SEGMENT = 1;
const ANSWER_SEGMENT = 3;

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

function pathFor(startY: number): [number, number][] {
  const middle = STAGE.middle;
  return [
    [STAGE.usersRight, startY],
    [STAGE.queue.start, middle],
    [QUEUE_END, middle],
    [BOX_CENTER, middle],
    [EXIT, middle],
  ];
}

/** Advance the picture to the sim's current time. `random` is injected so tests are repeatable. */
export function updateDots(field: DotField, state: SimState, random: () => number): DotField {
  if (state.time < field.lastTime) return { ...emptyField(), lastTime: state.time };
  const dt = state.time - field.lastTime;
  if (dt === 0) return field;

  const server = state.world.nodes.find((node): node is WorkNode => node.kind === 'server');
  const status = server ? state.nodes[server.id] : undefined;
  const incoming = status?.incoming ?? 0;
  const dropOdds = incoming > 0 ? (status?.dropped ?? 0) / incoming : 0;
  const queueFill = server && status ? status.queueLength / server.queueMax.value : 0;

  const dots: Dot[] = [];
  for (const dot of field.dots) {
    const moved = moveDot(dot, dt, queueFill, dropOdds, random);
    if (moved) dots.push(moved);
  }

  let spawnCredit = field.spawnCredit + (incoming > 0 ? dt * dotsPerSecond(incoming) : 0);
  let nextId = field.nextId;
  while (spawnCredit >= 1) {
    spawnCredit -= 1;
    if (dots.length >= MAX_DOTS) continue;
    const y = STAGE.middle + (random() - 0.5) * SPREAD;
    dots.push({
      id: nextId++,
      x: STAGE.usersRight,
      y,
      startY: y,
      fate: 'flowing',
      segment: 0,
      progress: 0,
      fallSpeed: 0,
      age: 0,
    });
  }
  return { dots, spawnCredit, nextId, lastTime: state.time };
}

function moveDot(
  dot: Dot,
  dt: number,
  queueFill: number,
  dropOdds: number,
  random: () => number,
): Dot | undefined {
  if (dot.fate === 'dropped') {
    const age = dot.age + dt;
    if (age > DROP_FADE_SECONDS) return undefined;
    const fallSpeed = dot.fallSpeed + GRAVITY * dt;
    return { ...dot, age, fallSpeed, x: dot.x + DROP_DRIFT * dt, y: dot.y + fallSpeed * dt };
  }

  const path = pathFor(dot.startY);
  let { segment, progress, fate } = dot;
  const speed =
    segment === QUEUE_SEGMENT
      ? SPEED / (1 + QUEUE_SLOWDOWN * queueFill)
      : segment >= ANSWER_SEGMENT
        ? EXIT_SPEED
        : SPEED;
  const [ax, ay] = path[segment] ?? [0, 0];
  const [bx, by] = path[segment + 1] ?? [0, 0];
  progress += (speed * dt) / (Math.hypot(bx - ax, by - ay) || 1);

  if (progress >= 1) {
    segment += 1;
    progress = 0;
    if (segment >= path.length - 1) return undefined;
    if (segment === QUEUE_SEGMENT && random() < dropOdds) {
      const [x, y] = path[segment] ?? [0, 0];
      return { ...dot, x, y, segment, progress, fate: 'dropped', fallSpeed: LAUNCH_SPEED, age: 0 };
    }
    if (segment === ANSWER_SEGMENT) fate = 'answered';
  }

  const [fromX, fromY] = path[segment] ?? [0, 0];
  const [toX, toY] = path[segment + 1] ?? [0, 0];
  return {
    ...dot,
    segment,
    progress,
    fate,
    x: fromX + (toX - fromX) * progress,
    y: fromY + (toY - fromY) * progress,
  };
}
