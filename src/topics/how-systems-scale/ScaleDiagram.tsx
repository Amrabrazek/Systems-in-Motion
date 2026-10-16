import type { PointerEvent } from 'react';
import {
  boxRect,
  canvasSize,
  cellArea,
  cells,
  center,
  describeDiagram,
  geometry,
  gridPosition,
  isFrame,
  linkedParts,
  linkForPart,
  regionLabelCell,
  wrapLabel,
  type Change,
  type Diagram,
  type DiagramPart,
  type Link,
  type Orientation,
  type PartId,
  type Rect,
} from './diagram';

const LINE_HEIGHT = 15;
const STACK_OFFSET = 5;
const changeText: Record<Change, string> = { new: '+ new', changed: '~ changed' };

/** Plain SVG, like the Flow stage (ADR 0006). No sim: this is a rung-1 picture (ADR 0013). */
export function ScaleDiagram({
  diagram,
  changes,
  orientation,
  activeLink,
  onLink,
}: {
  diagram: Diagram;
  changes: ReadonlyMap<PartId, Change>;
  orientation: Orientation;
  /** Lit up from the tradeoff strip, or by pointing at a box here. */
  activeLink: Link | undefined;
  onLink: (link: Link | undefined) => void;
}) {
  const lit = linkedParts(diagram, changes, activeLink);
  // Mouse hover previews. A tap toggles, since touch has no hover. The rows below are the
  // keyboard path, so boxes stay out of the tab order.
  const pointer = (id: PartId) => {
    const link = linkForPart(id, diagram, changes);
    if (!link) return {};
    return {
      onPointerEnter: (event: PointerEvent) => event.pointerType === 'mouse' && onLink(link),
      onPointerLeave: (event: PointerEvent) => event.pointerType === 'mouse' && onLink(undefined),
      onPointerUp: (event: PointerEvent) =>
        event.pointerType !== 'mouse' && onLink(activeLink === link ? undefined : link),
    };
  };
  const size = canvasSize(diagram, orientation);
  const boxes = diagram.parts.filter((part) => !isFrame(part.id));
  const frames = diagram.parts.filter((part) => isFrame(part.id));
  const middle = (id: DiagramPart['id']) => {
    const part = diagram.parts.find((candidate) => candidate.id === id);
    return center(boxRect(cells[id], orientation, part?.big));
  };

  return (
    <svg
      className={`scale-diagram scale-diagram--${orientation}`}
      viewBox={`0 0 ${size.width} ${size.height}`}
      role="img"
      aria-label={describeDiagram(diagram)}
    >
      {frames.map((part) => (
        <RegionFrame
          key={part.id}
          part={part}
          orientation={orientation}
          isLimit={diagram.limit?.part === part.id}
          limitWord={diagram.limit?.word}
          isLit={lit.has(part.id)}
          pointer={pointer(part.id)}
        />
      ))}
      {diagram.edges.map(({ from, to, copy }) => {
        const a = middle(from);
        const b = middle(to);
        return (
          <line
            key={`${from}-${to}`}
            className={copy ? 'scale-edge scale-edge--copy' : 'scale-edge'}
            x1={a.x}
            y1={a.y}
            x2={b.x}
            y2={b.y}
          />
        );
      })}
      {boxes.map((part) => (
        <PartBox
          key={part.id}
          part={part}
          orientation={orientation}
          change={changes.get(part.id)}
          limitWord={diagram.limit?.part === part.id ? diagram.limit.word : undefined}
          isLit={lit.has(part.id)}
          pointer={pointer(part.id)}
        />
      ))}
    </svg>
  );
}

function RegionFrame({
  part,
  orientation,
  isLimit,
  limitWord,
  isLit,
  pointer,
}: {
  part: DiagramPart;
  orientation: Orientation;
  isLimit: boolean;
  limitWord: string | undefined;
  isLit: boolean;
  pointer: PointerHandlers;
}) {
  const inset = 4;
  const classes = ['scale-region'];
  if (isLimit) classes.push('is-limit');
  if (isLit) classes.push('is-lit');
  const area = cellArea(cells[part.id], orientation);
  const label = center(cellArea(regionLabelCell, orientation));
  return (
    <g className={classes.join(' ')} {...pointer}>
      <rect
        className="scale-region-frame"
        x={area.x + inset}
        y={area.y + inset}
        width={area.width - inset * 2}
        height={area.height - inset * 2}
        rx={10}
      />
      <text className="scale-region-name" x={label.x} y={label.y} textAnchor="middle">
        {part.label}
      </text>
      {isLimit && limitWord && (
        <text
          className="scale-limit-word"
          x={label.x}
          y={label.y + LINE_HEIGHT}
          textAnchor="middle"
        >
          {`! ${limitWord.toUpperCase()}`}
        </text>
      )}
    </g>
  );
}

function PartBox({
  part,
  orientation,
  change,
  limitWord,
  isLit,
  pointer,
}: {
  part: DiagramPart;
  orientation: Orientation;
  change: Change | undefined;
  limitWord: string | undefined;
  isLit: boolean;
  pointer: PointerHandlers;
}) {
  const rect = boxRect(cells[part.id], orientation, part.big);
  const middle = center(rect);
  // Name, then what changed, then the limit: words inside the box, so it never relies on color.
  const geo = geometry[orientation];
  // A part spanning several cells (the second region) has room for longer lines.
  const { spanX } = gridPosition(cells[part.id], orientation);
  const rows = wrapLabel(part.label, geo.maxLabelChars * spanX).map((text) => ({
    text,
    className: 'scale-part-name',
  }));
  if (change) rows.push({ text: changeText[change], className: 'scale-change' });
  if (limitWord)
    for (const text of wrapLabel(`! ${limitWord.toUpperCase()}`, geo.maxMonoChars * spanX))
      rows.push({ text, className: 'scale-limit-word' });
  const firstBaseline = middle.y - ((rows.length - 1) * LINE_HEIGHT) / 2 + 5;
  const copiesBehind = (part.copies ?? 1) - 1;
  const classes = ['scale-part', `scale-part--${part.id}`];
  if (change) classes.push('is-changed');
  if (limitWord) classes.push('is-limit');
  if (isLit) classes.push('is-lit');

  return (
    <g className={classes.join(' ')} {...pointer}>
      {part.elastic && <BackCopy rect={rect} stepsBack={copiesBehind + 1} spare />}
      {Array.from({ length: copiesBehind }, (_, index) => (
        <BackCopy key={index} rect={rect} stepsBack={copiesBehind - index} />
      ))}
      <rect className="scale-box" {...rect} rx={10} />
      {rows.map((row, index) => (
        <text
          key={index}
          className={row.className}
          x={middle.x}
          y={firstBaseline + index * LINE_HEIGHT}
          textAnchor="middle"
        >
          {row.text}
        </text>
      ))}
    </g>
  );
}

type PointerHandlers = {
  onPointerEnter?: (event: PointerEvent) => void;
  onPointerLeave?: (event: PointerEvent) => void;
  onPointerUp?: (event: PointerEvent) => void;
};

/** A copy peeking out behind the box, up and to the right. A spare is dashed: it comes and goes. */
function BackCopy({ rect, stepsBack, spare }: { rect: Rect; stepsBack: number; spare?: boolean }) {
  const shift = stepsBack * STACK_OFFSET;
  return (
    <rect
      className={spare ? 'scale-box-back scale-box-back--spare' : 'scale-box-back'}
      x={rect.x + shift}
      y={rect.y - shift}
      width={rect.width}
      height={rect.height}
      rx={10}
    />
  );
}
