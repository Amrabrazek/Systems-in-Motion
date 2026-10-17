import type { PointerEvent, ReactNode } from 'react';
import type {
  CacheNode,
  LoadBalancerNode,
  NodeStatus,
  SimNode,
  SimState,
  UsersNode,
  WorkNode,
} from '../../engine';
import { boxLook, cacheLook, cacheWords, lookText } from './health';
import { pointAfterTap, type StageHighlight } from './highlight';
import { hasWaitingLine, stageLayout, type BoxPlace, type StageLayout } from './layout';
import { peopleShown, slotsFilled, STAGE } from './stageMath';
import './flow.css';

const format = (value: number) => Math.round(value).toLocaleString('en-US');
const COUNT_WORDS = ['NO', 'ONE', 'TWO', 'THREE', 'FOUR', 'FIVE'];

/**
 * The Flow stage: users ──▶ any boxes, laid out from the world graph (ADR 0012). Plain SVG
 * (ADR 0006). `dots` is drawn between the waiting lines and the boxes, so dots slide under a
 * box as they are served. `highlight` lights boxes by id; `onPointNode` reports which box the
 * reader points at (mouse hover, or a tap that toggles), so a page can light what goes with it.
 */
export function FlowStage({
  state,
  dots,
  highlight,
  onPointNode,
}: {
  state: SimState;
  dots?: ReactNode;
  highlight?: StageHighlight;
  onPointNode?: (id: string | undefined) => void;
}) {
  const { world } = state;
  const users = world.nodes.find((node): node is UsersNode => node.kind === 'users');
  if (!users) return null;
  const layout = stageLayout(world);
  const byId = new Map<string, SimNode>(world.nodes.map((node) => [node.id, node]));
  const workBoxes = world.nodes.filter((node): node is WorkNode => hasWaitingLine(node.kind));

  return (
    <svg
      className="flow-stage"
      viewBox={`0 0 ${layout.width} ${layout.height}`}
      role="img"
      aria-label={describe(state, workBoxes)}
    >
      <UsersGroup
        middle={layout.middle}
        count={world.traffic.users}
        requestsPerSecond={world.traffic.users * world.traffic.requestsPerUserPerSec.value}
      />
      {world.edges.map((edge) => {
        const path = layout.edges[edge.id];
        if (!path) return null;
        const [[x1, y1], [x2, y2]] = [path.from, path.to];
        return <line key={edge.id} className="flow-edge" x1={x1} y1={y1} x2={x2} y2={y2} />;
      })}
      {workBoxes.map((node) => {
        const place = layout.boxes[node.id];
        const status = state.nodes[node.id];
        if (!place || !status) return null;
        return <WaitingLine key={node.id} place={place} status={status} node={node} />;
      })}
      {dots}
      {Object.values(layout.boxes).map((place) => {
        const node = byId.get(place.id);
        const status = state.nodes[place.id];
        if (!node || !status) return null;
        const lit = highlight?.ids.has(node.id) ? highlight.tone : undefined;
        const pointer = onPointNode ? pointerFor(node.id, highlight, onPointNode) : {};
        if (node.kind === 'loadBalancer') {
          return (
            <RouterBox
              key={node.id}
              node={node}
              place={place}
              state={state}
              lit={lit}
              {...pointer}
            />
          );
        }
        if (node.kind === 'cache') {
          return (
            <CacheBox
              key={node.id}
              node={node}
              place={place}
              state={state}
              lit={lit}
              {...pointer}
            />
          );
        }
        if (node.kind === 'server' || node.kind === 'database') {
          return (
            <ServerBox
              key={node.id}
              node={node}
              place={place}
              status={status}
              lit={lit}
              {...pointer}
            />
          );
        }
        return null;
      })}
      <ColumnCaptions layout={layout} byId={byId} />
    </svg>
  );
}

type PointerHandlers = {
  onPointerEnter?: (event: PointerEvent) => void;
  onPointerLeave?: (event: PointerEvent) => void;
  onPointerUp?: (event: PointerEvent) => void;
};

function pointerFor(
  id: string,
  highlight: StageHighlight | undefined,
  onPointNode: (id: string | undefined) => void,
): PointerHandlers {
  return {
    onPointerEnter: (event) => {
      if (event.pointerType === 'mouse') onPointNode(id);
    },
    onPointerLeave: (event) => {
      if (event.pointerType === 'mouse') onPointNode(undefined);
    },
    onPointerUp: (event) => {
      if (event.pointerType !== 'mouse') onPointNode(pointAfterTap(id, highlight));
    },
  };
}

/** A ring just outside the box frame, so lighting never hides the health color inside it. */
function Halo({ place, tone }: { place: BoxPlace; tone: StageHighlight['tone'] }) {
  const pad = 5;
  return (
    <rect
      className={`flow-box-halo flow-box-halo--${tone}`}
      x={place.x - pad}
      y={place.top - pad}
      width={place.width + pad * 2}
      height={place.height + pad * 2}
      rx={14}
    />
  );
}

function boxClass(base: string, lit: StageHighlight['tone'] | undefined): string {
  return lit ? `${base} is-lit` : base;
}

function describe(state: SimState, workBoxes: WorkNode[]): string {
  const servers = workBoxes.filter((node) => node.kind === 'server');
  const rest = describeBehindServers(state, workBoxes);
  return `${describeServers(state, servers)}${rest}`;
}

/** The cache and database part of the stage's spoken summary, or '' when there is none. */
function describeBehindServers(state: SimState, workBoxes: WorkNode[]): string {
  const caches = state.world.nodes.filter((node): node is CacheNode => node.kind === 'cache');
  const sentences = caches.map((node) => {
    const view = state.cacheView[node.id];
    const look = cacheWords[cacheLook(node, view)].slice(2).toLowerCase();
    if (!node.up) return ` The ${node.label.toLowerCase()} is down and passes every request on.`;
    return ` The ${node.label.toLowerCase()} is ${look} and answers ${hitPercent(view?.hitRate)} from memory.`;
  });
  for (const node of workBoxes.filter((box) => box.kind === 'database')) {
    const status = state.nodes[node.id];
    if (!status) continue;
    const look = lookText(boxLook(node, status)).slice(2).toLowerCase();
    sentences.push(` The ${node.label.toLowerCase()} is ${look}.`);
  }
  return sentences.join('');
}

const hitPercent = (hitRate = 0) => `${Math.round(hitRate * 100)}%`;

function describeServers(state: SimState, servers: WorkNode[]): string {
  const users = `${format(state.world.traffic.users)} users send requests to`;
  if (servers.length === 1) {
    const [server] = servers;
    const status = server && state.nodes[server.id];
    if (!server || !status) return users;
    const look = lookText(boxLook(server, status)).slice(2).toLowerCase();
    return `${users} the ${server.label.toLowerCase()}. It is ${look}.`;
  }
  const each = servers
    .map((node) => {
      const status = state.nodes[node.id];
      return status
        ? `${node.label} ${lookText(boxLook(node, status)).slice(2).toLowerCase()}`
        : '';
    })
    .filter(Boolean)
    .join(', ');
  return `${users} ${servers.length} servers. ${each}.`;
}

function UsersGroup({
  middle,
  count,
  requestsPerSecond,
}: {
  middle: number;
  count: number;
  requestsPerSecond: number;
}) {
  const { columns, rows, gap, x, radius } = STAGE.people;
  const lit = peopleShown(count);
  const top = middle - ((rows - 1) * gap) / 2;
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

function WaitingLine({
  place,
  status,
  node,
}: {
  place: BoxPlace;
  status: NodeStatus;
  node: WorkNode;
}) {
  const { size, gap } = STAGE.queue;
  const filled = slotsFilled(status.queueLength, node.queueMax.value);
  const full = filled === STAGE.queue.slots;
  const [end, y] = place.door;
  return (
    <g className="flow-queue">
      <line className="flow-track" x1={place.entry[0]} y1={y} x2={end} y2={y} />
      {Array.from({ length: filled }, (_, index) => (
        // Fills from the box outward: the slot touching the box is first in line.
        <rect
          key={index}
          className={full ? 'slot slot--full' : 'slot'}
          x={end - (index + 1) * gap}
          y={y - size / 2}
          width={size}
          height={size}
          rx={1.5}
        />
      ))}
      {status.queueLength > 0 && (
        <text className="flow-label" x={end} y={y + 24} textAnchor="end">
          {format(status.queueLength)} waiting
        </text>
      )}
    </g>
  );
}

function ServerBox({
  node,
  place,
  status,
  lit,
  ...pointer
}: {
  node: WorkNode;
  place: BoxPlace;
  status: NodeStatus;
  lit: StageHighlight['tone'] | undefined;
} & PointerHandlers) {
  const { x, top, width, height, compact } = place;
  const look = boxLook(node, status);
  const inner = x + 12;
  const barWidth = width - 24;
  const line = compact ? { name: 22, state: 42, bar: 52 } : { name: 24, state: 48, bar: 60 };
  return (
    <g className={boxClass(`flow-box flow-box--${look}`, lit)} {...pointer}>
      {lit && <Halo place={place} tone={lit} />}
      <rect className="flow-box-frame" x={x} y={top} width={width} height={height} rx={10} />
      <text className="flow-box-name" x={inner} y={top + line.name}>
        {node.label}
      </text>
      {node.awsTag && (
        <text className="flow-box-aws" x={x + width - 10} y={top + line.name} textAnchor="end">
          {node.awsTag}
        </text>
      )}
      <text className="flow-box-state" x={inner} y={top + line.state}>
        {look === 'down'
          ? lookText(look)
          : `${lookText(look)} · ${Math.round(status.utilization * 100)}%`}
      </text>
      {look !== 'down' && (
        <>
          <rect
            className="flow-box-bar"
            x={inner}
            y={top + line.bar}
            width={barWidth}
            height={6}
            rx={3}
          />
          <rect
            className="flow-box-bar-fill"
            x={inner}
            y={top + line.bar}
            width={barWidth * Math.min(status.utilization, 1)}
            height={6}
            rx={3}
          />
        </>
      )}
      {!compact && (
        <text className="flow-box-note" x={inner} y={top + 88}>
          {look === 'down'
            ? 'turns every request away'
            : `handles ~${format(node.capacity.value)} requests/s`}
        </text>
      )}
    </g>
  );
}

/** A router has no capacity or line (ADR 0011). It shows how many servers it still sends to. */
function RouterBox({
  node,
  place,
  state,
  lit,
  ...pointer
}: {
  node: LoadBalancerNode;
  place: BoxPlace;
  state: SimState;
  lit: StageHighlight['tone'] | undefined;
} & PointerHandlers) {
  const { x, top, width, height } = place;
  const targets = state.world.edges.filter((edge) => edge.from === node.id);
  const sending = targets.filter((edge) => (state.edges[edge.id]?.rate ?? 0) > 0).length;
  const inner = x + 10;
  return (
    <g className={boxClass('flow-box flow-box--router', lit)} {...pointer}>
      {lit && <Halo place={place} tone={lit} />}
      <rect className="flow-box-frame" x={x} y={top} width={width} height={height} rx={10} />
      <text className="flow-box-name flow-box-name--small" x={inner} y={top + 22}>
        {node.label}
      </text>
      {node.awsTag && (
        <text className="flow-box-aws" x={inner} y={top + 40}>
          {node.awsTag}
        </text>
      )}
      <text className="flow-box-note" x={inner} y={top + 60}>
        sends to {sending} of {targets.length}
      </text>
    </g>
  );
}

/**
 * A cache has no capacity or line (ADR 0014). Its look says how full it is (warm, warming up,
 * down), and the bar shows the share of requests it answers from memory.
 */
function CacheBox({
  node,
  place,
  state,
  lit,
  ...pointer
}: {
  node: CacheNode;
  place: BoxPlace;
  state: SimState;
  lit: StageHighlight['tone'] | undefined;
} & PointerHandlers) {
  const { x, top, width, height } = place;
  const hitRate = state.cacheView[node.id]?.hitRate ?? 0;
  const look = cacheLook(node, state.cacheView[node.id]);
  const inner = x + 12;
  const barWidth = width - 24;
  return (
    <g className={boxClass(`flow-box flow-box--${look}`, lit)} {...pointer}>
      {lit && <Halo place={place} tone={lit} />}
      <rect className="flow-box-frame" x={x} y={top} width={width} height={height} rx={10} />
      <text className="flow-box-name" x={inner} y={top + 24}>
        {node.label}
      </text>
      {node.awsTag && (
        <text className="flow-box-aws" x={x + width - 10} y={top + 24} textAnchor="end">
          {node.awsTag}
        </text>
      )}
      <text className="flow-box-state" x={inner} y={top + 46}>
        {cacheWords[look]}
      </text>
      {look !== 'down' && (
        <>
          <rect
            className="flow-box-bar"
            x={inner}
            y={top + 56}
            width={barWidth}
            height={6}
            rx={3}
          />
          <rect
            className="flow-box-bar-fill"
            x={inner}
            y={top + 56}
            width={barWidth * Math.min(hitRate, 1)}
            height={6}
            rx={3}
          />
        </>
      )}
      <text className="flow-box-note" x={inner} y={top + 78}>
        {look === 'down' ? 'passes every request on' : `answers ${hitPercent(hitRate)} from memory`}
      </text>
    </g>
  );
}

/** "ONE SERVER", "3 SERVERS": under each column of servers, like the M1 picture. */
function ColumnCaptions({ layout, byId }: { layout: StageLayout; byId: Map<string, SimNode> }) {
  return (
    <>
      {layout.columns.map((ids, index) => {
        if (!ids.every((id) => byId.get(id)?.kind === 'server')) return null;
        const places = ids.map((id) => layout.boxes[id]).filter((place) => place !== undefined);
        const last = places[places.length - 1];
        if (!last) return null;
        const count = COUNT_WORDS[ids.length] ?? String(ids.length);
        return (
          <text
            key={index}
            className="flow-caption"
            x={last.x + last.width / 2}
            y={last.top + last.height + 28}
            textAnchor="middle"
          >
            {count} {ids.length === 1 ? 'SERVER' : 'SERVERS'}
          </text>
        );
      })}
    </>
  );
}
