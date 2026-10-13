import { useEffect, useRef } from 'react';
import type { Sim } from '../../sim';
import { emptyField, updateDots, type Dot } from './dots';

const SVG_NS = 'http://www.w3.org/2000/svg';
const DOT_RADIUS = 4;
const FADE_SECONDS = 0.9;

/**
 * Request dots, drawn every frame outside React (ADR 0005): React mounts the <g> once, then the
 * sim's frame callback moves plain SVG circles. Random here is fine: dots are only a picture.
 */
export function DotLayer({ sim }: { sim: Sim }) {
  const layer = useRef<SVGGElement>(null);

  useEffect(() => {
    const group = layer.current;
    if (!group) return;
    let field = emptyField();
    const circles = new Map<number, SVGCircleElement>();

    const unsubscribe = sim.onFrame((state) => {
      field = updateDots(field, state, Math.random);
      const alive = new Set<number>();
      for (const dot of field.dots) {
        alive.add(dot.id);
        draw(circleFor(dot), dot);
      }
      for (const [id, circle] of circles) {
        if (!alive.has(id)) {
          circle.remove();
          circles.delete(id);
        }
      }
    });

    function circleFor(dot: Dot): SVGCircleElement {
      let circle = circles.get(dot.id);
      if (!circle) {
        circle = document.createElementNS(SVG_NS, 'circle');
        circle.setAttribute('r', String(DOT_RADIUS));
        group?.appendChild(circle);
        circles.set(dot.id, circle);
      }
      return circle;
    }

    return () => {
      unsubscribe();
      for (const circle of circles.values()) circle.remove();
    };
  }, [sim]);

  return <g ref={layer} className="flow-dots" aria-hidden="true" />;
}

function draw(circle: SVGCircleElement, dot: Dot) {
  circle.setAttribute('cx', dot.x.toFixed(1));
  circle.setAttribute('cy', dot.y.toFixed(1));
  circle.setAttribute('class', `dot dot--${dot.fate}`);
  if (dot.fate === 'dropped') {
    circle.setAttribute('opacity', Math.max(0, 1 - dot.age / FADE_SECONDS).toFixed(2));
  }
}
