import type { NodeStatus, SimState, UsersNode, WorkNode } from '../../engine';
import { healthText } from './health';
import { peopleShown, QUEUE_SLOTS, slotsFilled, USERS_COLUMNS, USERS_ROWS } from './stageMath';
import './flow.css';

// Stage geometry in SVG units. The viewBox scales it to the panel width.
const WIDTH = 640;
const HEIGHT = 170;
const MIDDLE = HEIGHT / 2;
const USERS_X = 20;
const PERSON_GAP = 22;
const QUEUE_X = 280;
const SLOT_SIZE = 7;
const SLOT_GAP = 3;
const BOX_X = 440;
const BOX_WIDTH = 180;
const BOX_HEIGHT = 104;
const BAR_HEIGHT = 8;

/**
 * The M1 Flow stage: users ──▶ waiting line ──▶ one box. Plain SVG (ADR 0006). Dots are drawn
 * on top by the DotLayer in step 5; this layer only shows state.
 */
export function FlowStage({ state }: { state: SimState }) {
  const users = state.world.nodes.find((node): node is UsersNode => node.kind === 'users');
  const server = state.world.nodes.find((node): node is WorkNode => node.kind === 'server');
  const status = server ? state.nodes[server.id] : undefined;
  if (!users || !server || !status) return null;

  const userCount = state.world.traffic.users;
  return (
    <svg
      className="flow-stage"
      viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
      role="img"
      aria-label={`${userCount.toLocaleString('en-US')} users send requests to the ${server.label.toLowerCase()}, which is ${healthText(status.health).slice(2).toLowerCase()}.`}
    >
      <UsersGroup label={users.label} count={userCount} />
      <line className="flow-edge" x1={150} y1={MIDDLE} x2={QUEUE_X - SLOT_GAP * 2} y2={MIDDLE} />
      <WaitingLine status={status} queueMax={server.queueMax.value} />
      <ServerBox node={server} status={status} />
    </svg>
  );
}

function UsersGroup({ label, count }: { label: string; count: number }) {
  const lit = peopleShown(count);
  const top = MIDDLE - PERSON_GAP;
  const people = Array.from({ length: USERS_COLUMNS * USERS_ROWS }, (_, index) => ({
    x: USERS_X + (index % USERS_COLUMNS) * PERSON_GAP + PERSON_GAP / 2,
    y: top + Math.floor(index / USERS_COLUMNS) * PERSON_GAP,
    lit: index < lit,
  }));
  return (
    <g className="flow-users">
      {people.map((person, index) => (
        <circle
          key={index}
          className={person.lit ? 'person person--lit' : 'person'}
          cx={person.x}
          cy={person.y}
          r={6}
        />
      ))}
      <text className="flow-label" x={USERS_X} y={top + USERS_ROWS * PERSON_GAP + 4}>
        {count.toLocaleString('en-US')} {label.toLowerCase()}
      </text>
    </g>
  );
}

function WaitingLine({ status, queueMax }: { status: NodeStatus; queueMax: number }) {
  const filled = slotsFilled(status.queueLength, queueMax);
  const full = filled === QUEUE_SLOTS;
  return (
    <g className="flow-queue">
      {Array.from({ length: QUEUE_SLOTS }, (_, index) => {
        // Fills right to left: the slot next to the box is first in line.
        const fromBox = QUEUE_SLOTS - 1 - index;
        const className =
          fromBox < filled ? (full ? 'slot slot--full' : 'slot slot--waiting') : 'slot';
        return (
          <rect
            key={index}
            className={className}
            x={QUEUE_X + index * (SLOT_SIZE + SLOT_GAP)}
            y={MIDDLE - SLOT_SIZE / 2}
            width={SLOT_SIZE}
            height={SLOT_SIZE}
            rx={1.5}
          />
        );
      })}
      <text className="flow-label" x={QUEUE_X} y={MIDDLE + 26}>
        {Math.round(status.queueLength)} waiting
      </text>
    </g>
  );
}

function ServerBox({ node, status }: { node: WorkNode; status: NodeStatus }) {
  const top = MIDDLE - BOX_HEIGHT / 2;
  const inner = BOX_X + 14;
  const barWidth = BOX_WIDTH - 28;
  const busy = Math.min(status.utilization, 1);
  return (
    <g className={`flow-box flow-box--${status.health}`}>
      <rect
        className="flow-box-frame"
        x={BOX_X}
        y={top}
        width={BOX_WIDTH}
        height={BOX_HEIGHT}
        rx={10}
      />
      <text className="flow-box-name" x={inner} y={top + 26}>
        {node.label}
      </text>
      {node.awsTag && (
        <text className="flow-box-aws" x={BOX_X + BOX_WIDTH - 14} y={top + 26} textAnchor="end">
          {node.awsTag}
        </text>
      )}
      <text className="flow-box-state" x={inner} y={top + 52}>
        {healthText(status.health)} · {Math.round(status.utilization * 100)}%
      </text>
      <rect
        className="flow-box-bar"
        x={inner}
        y={top + 70}
        width={barWidth}
        height={BAR_HEIGHT}
        rx={4}
      />
      <rect
        className="flow-box-bar-fill"
        x={inner}
        y={top + 70}
        width={barWidth * busy}
        height={BAR_HEIGHT}
        rx={4}
      />
    </g>
  );
}
