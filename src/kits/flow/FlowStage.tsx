import type { ReactNode } from 'react';
import type { NodeStatus, SimState, UsersNode, WorkNode } from '../../engine';
import { healthText } from './health';
import { peopleShown, slotsFilled, STAGE } from './stageMath';
import './flow.css';

const format = (value: number) => Math.round(value).toLocaleString('en-US');

/**
 * The M1 Flow stage: users ──▶ waiting line ──▶ one box. Plain SVG (ADR 0006). `dots` is drawn
 * between the lines and the box, so dots slide under the box as they are served.
 */
export function FlowStage({ state, dots }: { state: SimState; dots?: ReactNode }) {
  const users = state.world.nodes.find((node): node is UsersNode => node.kind === 'users');
  const server = state.world.nodes.find((node): node is WorkNode => node.kind === 'server');
  const status = server ? state.nodes[server.id] : undefined;
  if (!users || !server || !status) return null;

  const { traffic } = state.world;
  const { middle, queue, box } = STAGE;
  return (
    <svg
      className="flow-stage"
      viewBox={`0 0 ${STAGE.width} ${STAGE.height}`}
      role="img"
      aria-label={`${format(traffic.users)} users send requests to the ${server.label.toLowerCase()}. It is ${healthText(status.health).slice(2).toLowerCase()}.`}
    >
      <UsersGroup
        count={traffic.users}
        requestsPerSecond={traffic.users * traffic.requestsPerUserPerSec.value}
      />
      <line className="flow-edge" x1={STAGE.usersRight} y1={middle} x2={queue.start} y2={middle} />
      <line className="flow-track" x1={queue.start} y1={middle} x2={box.x - 8} y2={middle} />
      <WaitingLine status={status} queueMax={server.queueMax.value} />
      {dots}
      <ServerBox node={server} status={status} />
    </svg>
  );
}

function UsersGroup({ count, requestsPerSecond }: { count: number; requestsPerSecond: number }) {
  const { columns, rows, gap, x, radius } = STAGE.people;
  const lit = peopleShown(count);
  const top = STAGE.middle - ((rows - 1) * gap) / 2;
  const centerX = x + ((columns - 1) * gap) / 2;
  return (
    <g className="flow-users">
      <text className="flow-caption" x={centerX} y={top - 18} textAnchor="middle">
        USERS
      </text>
      {Array.from({ length: columns * rows }, (_, index) => (
        <circle
          key={index}
          className={index < lit ? 'person person--lit' : 'person'}
          cx={x + (index % columns) * gap}
          cy={top + Math.floor(index / columns) * gap}
          r={radius}
        />
      ))}
      <text className="flow-users-count" x={centerX} y={top + rows * gap + 14} textAnchor="middle">
        {format(count)} users
      </text>
      <text className="flow-label" x={centerX} y={top + rows * gap + 32} textAnchor="middle">
        ≈ {format(requestsPerSecond)} requests/s
      </text>
    </g>
  );
}

function WaitingLine({ status, queueMax }: { status: NodeStatus; queueMax: number }) {
  const { slots, size, gap } = STAGE.queue;
  const filled = slotsFilled(status.queueLength, queueMax);
  const full = filled === slots;
  const end = STAGE.box.x - 8;
  return (
    <g className="flow-queue">
      {Array.from({ length: filled }, (_, index) => (
        // Fills from the box outward: the slot touching the box is first in line.
        <rect
          key={index}
          className={full ? 'slot slot--full' : 'slot'}
          x={end - (index + 1) * gap}
          y={STAGE.middle - size / 2}
          width={size}
          height={size}
          rx={1.5}
        />
      ))}
      {status.queueLength > 0 && (
        <text className="flow-label" x={end} y={STAGE.middle + 24} textAnchor="end">
          {format(status.queueLength)} waiting
        </text>
      )}
    </g>
  );
}

function ServerBox({ node, status }: { node: WorkNode; status: NodeStatus }) {
  const { x, width, height } = STAGE.box;
  const top = STAGE.middle - height / 2;
  const inner = x + 12;
  const barWidth = width - 24;
  return (
    <g className={`flow-box flow-box--${status.health}`}>
      <rect className="flow-box-frame" x={x} y={top} width={width} height={height} rx={10} />
      <text className="flow-box-name" x={inner} y={top + 24}>
        {node.label}
      </text>
      {node.awsTag && (
        <text className="flow-box-aws" x={x + width - 10} y={top + 24} textAnchor="end">
          {node.awsTag}
        </text>
      )}
      <text className="flow-box-state" x={inner} y={top + 48}>
        {healthText(status.health)} · {Math.round(status.utilization * 100)}%
      </text>
      <rect className="flow-box-bar" x={inner} y={top + 60} width={barWidth} height={6} rx={3} />
      <rect
        className="flow-box-bar-fill"
        x={inner}
        y={top + 60}
        width={barWidth * Math.min(status.utilization, 1)}
        height={6}
        rx={3}
      />
      <text className="flow-box-note" x={inner} y={top + 88}>
        handles ~{format(node.capacity.value)} requests/s
      </text>
      <text className="flow-caption" x={x + width / 2} y={top + height + 28} textAnchor="middle">
        ONE SERVER
      </text>
    </g>
  );
}
