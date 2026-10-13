import { useEffect, useRef } from 'react';
import uPlot from 'uplot';
import 'uplot/dist/uPlot.min.css';
import type { Sim } from '../../sim';
import { niceMax, withAlpha } from './chartMath';
import { addSample, emptyHistory, WINDOW_SECONDS, type History } from './history';

type Series = 'latencyMs' | 'errorPercent';

const HEIGHT = 150;
const AREA_ALPHA = 0.12;

/** Live chart (design system part 7): last 60 s of one smoothed total, fed by the sim's frames. */
export function LiveChart({
  sim,
  series,
  label,
  colorToken,
  steps,
  formatTick,
  threshold,
}: {
  sim: Sim;
  series: Series;
  label: string;
  colorToken: string;
  steps: readonly number[];
  formatTick: (value: number) => string;
  threshold?: number;
}) {
  const box = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const container = box.current;
    if (!container) return;
    let history: History = emptyHistory();
    let chart = build();

    function build() {
      const token = (name: string) =>
        getComputedStyle(document.documentElement).getPropertyValue(name).trim();
      const color = token(colorToken);
      const grid = { stroke: token('--color-border'), width: 1 };
      const axis = {
        stroke: token('--color-text-muted'),
        font: `12px ${token('--font-mono')}`,
        grid,
        ticks: { show: false },
      };
      return new uPlot(
        {
          width: container?.clientWidth ?? 0,
          height: HEIGHT,
          legend: { show: false },
          cursor: { y: false, points: { show: false } },
          scales: {
            x: { time: false, range: [-WINDOW_SECONDS, 0] },
            y: {
              range: (_chart, _min, max) => [0, niceMax(Math.max(max, threshold ?? 0, 0), steps)],
            },
          },
          axes: [
            {
              ...axis,
              values: (_chart, ticks) => ticks.map((tick) => (tick === 0 ? 'now' : `${tick} s`)),
            },
            { ...axis, size: 56, values: (_chart, ticks) => ticks.map(formatTick) },
          ],
          series: [
            {},
            {
              label,
              stroke: color,
              width: 2,
              fill: withAlpha(color, AREA_ALPHA),
              points: { show: false },
            },
          ],
          hooks: threshold
            ? {
                draw: [
                  (self) => {
                    const y = self.valToPos(threshold, 'y', true);
                    const { left, width } = self.bbox;
                    const context = self.ctx;
                    context.save();
                    context.setLineDash([4, 4]);
                    context.strokeStyle = token('--color-text-muted');
                    context.beginPath();
                    context.moveTo(left, y);
                    context.lineTo(left + width, y);
                    context.stroke();
                    context.restore();
                  },
                ],
              }
            : {},
        },
        [[], []],
        container as HTMLElement,
      );
    }

    function redraw() {
      const now = history.times.at(-1) ?? 0;
      chart.setData([history.times.map((time) => time - now), history[series]]);
    }

    const unsubscribe = sim.onFrame((state) => {
      const next = addSample(history, state);
      if (next === history) return;
      history = next;
      redraw();
    });

    const resize = new ResizeObserver(() =>
      chart.setSize({ width: container.clientWidth, height: HEIGHT }),
    );
    resize.observe(container);

    // Colors come from tokens, which change with the OS theme: rebuild when it flips.
    const theme = window.matchMedia('(prefers-color-scheme: dark)');
    const rebuild = () => {
      chart.destroy();
      chart = build();
      redraw();
    };
    theme.addEventListener('change', rebuild);

    return () => {
      unsubscribe();
      resize.disconnect();
      theme.removeEventListener('change', rebuild);
      chart.destroy();
    };
  }, [sim, series, label, colorToken, steps, formatTick, threshold]);

  return (
    <div ref={box} className="live-chart" role="img" aria-label={`${label}, last 60 seconds`} />
  );
}
