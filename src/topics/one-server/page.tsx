import { useEffect, useState } from 'react';
import type { WorkNode } from '../../engine';
import { getNumber } from '../../data/numbers';
import { DotLayer } from '../../kits/flow/DotLayer';
import { requestsPerDot } from '../../kits/flow/dots';
import { FlowStage } from '../../kits/flow/FlowStage';
import { lookText } from '../../kits/flow/health';
import { whyForState } from '../../kits/flow/why';
import { browserClock, createSim, useSim } from '../../sim';
import { LiveChart } from '../../ui/shared/LiveChart';
import { positionToValue, usersScale, valueToPosition } from '../../ui/shared/logScale';
import { NumberTag } from '../../ui/shared/NumberTag';
import { SimControls } from '../../ui/shared/SimControls';
import { UsersSlider } from '../../ui/shared/UsersSlider';
import { oneServerWorld, START_USERS } from './world';

const feelsSlow = getNumber('teaching', 'ux.feelsSlowMs');
const latencySteps = [200, 500, 1000, 2000, 5000];
const errorSteps = [10, 20, 50, 100];
const formatMs = (ms: number) =>
  ms >= 1000 ? `${(ms / 1000).toFixed(1)} s` : `${Math.round(ms)} ms`;
const formatPercent = (percent: number) => `${Math.round(percent)}%`;

export default function OneServerPage() {
  // One sim per page visit. useState (not useMemo) so React never throws it away.
  const [sim] = useState(() => createSim(oneServerWorld(), browserClock));
  const [position, setPosition] = useState(() => valueToPosition(usersScale, START_USERS));
  const snapshot = useSim(sim);

  useEffect(() => {
    sim.start();
    return () => sim.stop();
  }, [sim]);

  const { state } = snapshot;
  const server = state.world.nodes.find((node): node is WorkNode => node.kind === 'server');
  const why = whyForState(state);

  function moveSlider(next: number) {
    setPosition(next);
    sim.dispatch({ type: 'setUsers', users: positionToValue(usersScale, next) });
  }

  function reset() {
    setPosition(valueToPosition(usersScale, START_USERS));
    sim.reset();
  }

  return (
    <article className="topic">
      <h1>One server</h1>
      <p className="muted">
        Move the slider to add users. Each one sends a request now and then. Watch what the server
        does when more arrive than it can finish.
      </p>

      <section className="panel stage-panel" aria-label="Live system">
        <div className="stage">
          <FlowStage state={state} dots={<DotLayer sim={sim} />} />
        </div>
        <div className="panel-row controls-row">
          <UsersSlider position={position} onChange={moveSlider} />
          <SimControls sim={sim} snapshot={snapshot} onReset={reset} />
        </div>
        {why && (
          <p className="panel-row why" aria-live="polite">
            <span className={`pill pill--${why.look}`}>{lookText(why.look)}</span>
            <span>
              {why.parts.map((part, index) =>
                part.bold ? (
                  <strong key={index}>{part.text}</strong>
                ) : (
                  <span key={index}>{part.text}</span>
                ),
              )}
            </span>
          </p>
        )}
      </section>

      <div className="charts">
        <section className="panel chart" aria-label="Latency">
          <div className="chart-head">
            <h2>Wait time per request (latency)</h2>
            <span className="chart-now">{formatMs(state.smoothed.latencyMs)}</span>
          </div>
          <LiveChart
            sim={sim}
            series="latencyMs"
            label="Latency"
            colorToken="--color-accent"
            steps={latencySteps}
            formatTick={formatMs}
            threshold={feelsSlow.value}
          />
          <p className="chart-foot">
            Last 60 s. Dashed line: people notice delay past{' '}
            <NumberTag entry={feelsSlow}>~1 s</NumberTag>
          </p>
        </section>
        <section className="panel chart" aria-label="Errors">
          <div className="chart-head">
            <h2>Requests failing (errors)</h2>
            <span className="chart-now">
              {(state.smoothed.errorRate * 100).toFixed(state.smoothed.errorRate < 0.1 ? 1 : 0)}%
            </span>
          </div>
          <LiveChart
            sim={sim}
            series="errorPercent"
            label="Errors"
            colorToken="--color-bad"
            steps={errorSteps}
            formatTick={formatPercent}
          />
          <p className="chart-foot">
            Last 60 s. Share of requests turned away because the line is full.
          </p>
        </section>
      </div>

      {server && (
        <p className="facts muted">
          Each user sends{' '}
          <NumberTag entry={state.world.traffic.requestsPerUserPerSec}>
            {state.world.traffic.requestsPerUserPerSec.value} req/s
          </NumberTag>
          . The server finishes{' '}
          <NumberTag entry={server.capacity}>{server.capacity.value} req/s</NumberTag>. Its waiting
          line holds <NumberTag entry={server.queueMax}>{server.queueMax.value}</NumberTag>{' '}
          requests. 1 dot ≈{' '}
          <span className="number-value">
            {requestsPerDot(
              state.world.traffic.users * state.world.traffic.requestsPerUserPerSec.value,
            )}
          </span>{' '}
          requests: dots are a picture, the math runs underneath.
        </p>
      )}
    </article>
  );
}
