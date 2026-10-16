import { useEffect, useState } from 'react';
import { getNumber } from '../../data/numbers';
import { DotLayer } from '../../kits/flow/DotLayer';
import { FlowStage } from '../../kits/flow/FlowStage';
import { lookText } from '../../kits/flow/health';
import { whyForState } from '../../kits/flow/why';
import { browserClock, createSim, useSim } from '../../sim';
import { LiveChart } from '../../ui/shared/LiveChart';
import { meters } from '../../ui/shared/meters';
import { positionToValue, usersScale, valueToPosition } from '../../ui/shared/logScale';
import { NumberTag } from '../../ui/shared/NumberTag';
import { SimControls } from '../../ui/shared/SimControls';
import { TradeoffCard } from '../../ui/shared/TradeoffCard';
import { UsersSlider } from '../../ui/shared/UsersSlider';
import { addLoadBalancerCard } from './tradeoff';
import {
  loadBalancerWorld,
  MAX_SERVERS,
  MIN_SERVERS,
  serversOf,
  START_USERS,
  withServerCount,
} from './world';
import './page.css';

const feelsSlow = getNumber('teaching', 'ux.feelsSlowMs');
const latencySteps = [200, 500, 1000, 2000, 5000];
const errorSteps = [10, 20, 50, 100];
const formatMs = (ms: number) =>
  ms >= 1000 ? `${(ms / 1000).toFixed(1)} s` : `${Math.round(ms)} ms`;
const formatPercent = (percent: number) => `${Math.round(percent)}%`;

export default function LoadBalancerPage() {
  const [sim] = useState(() => createSim(loadBalancerWorld(), browserClock));
  const [position, setPosition] = useState(() => valueToPosition(usersScale, START_USERS));
  const snapshot = useSim(sim);

  useEffect(() => {
    sim.start();
    return () => sim.stop();
  }, [sim]);

  const { state } = snapshot;
  // Read from the sim, not React state, so Reset can never leave the controls out of date.
  const servers = serversOf(state.world);
  const lb = state.world.nodes.find((node) => node.kind === 'loadBalancer');
  const why = whyForState(state);

  function moveSlider(next: number) {
    setPosition(next);
    sim.dispatch({ type: 'setUsers', users: positionToValue(usersScale, next) });
  }

  function setServerCount(count: number) {
    sim.dispatch({ type: 'replaceWorld', world: withServerCount(state.world, count) });
  }

  function reset() {
    setPosition(valueToPosition(usersScale, START_USERS));
    sim.reset();
  }

  return (
    <article className="topic">
      <h1>Load balancer</h1>
      <p className="muted">
        A load balancer hands each request to one of several servers, taking turns. Kill a server
        and watch what the others have to carry.
      </p>

      <section className="panel stage-panel" aria-label="Live system">
        <div className="stage">
          <FlowStage state={state} dots={<DotLayer sim={sim} />} />
        </div>
        <div className="panel-row controls-row">
          <UsersSlider position={position} onChange={moveSlider} />
          <SimControls sim={sim} snapshot={snapshot} onReset={reset} />
        </div>
        <div className="panel-row server-controls">
          <div className="server-count" role="group" aria-label="Number of servers">
            <span>Servers</span>
            <button
              type="button"
              className="button"
              aria-label="Remove a server"
              disabled={servers.length <= MIN_SERVERS}
              onClick={() => setServerCount(servers.length - 1)}
            >
              −
            </button>
            <output className="number-value">{servers.length}</output>
            <button
              type="button"
              className="button"
              aria-label="Add a server"
              disabled={servers.length >= MAX_SERVERS}
              onClick={() => setServerCount(servers.length + 1)}
            >
              +
            </button>
          </div>
          <div className="server-switches" role="group" aria-label="Kill or revive a server">
            {servers.map((node) =>
              node.up ? (
                <button
                  key={node.id}
                  type="button"
                  className="button button--kill"
                  onClick={() => sim.dispatch({ type: 'killNode', nodeId: node.id })}
                >
                  ✕ Kill {node.label}
                </button>
              ) : (
                <button
                  key={node.id}
                  type="button"
                  className="button button--revive"
                  onClick={() => sim.dispatch({ type: 'reviveNode', nodeId: node.id })}
                >
                  ↺ Revive {node.label}
                </button>
              ),
            )}
          </div>
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
        {/* The tradeoffs live in the same panel as the system they describe (design system part 5). */}
        <TradeoffCard
          name="Load balancer + second server"
          awsTag="ELB"
          card={addLoadBalancerCard}
          meters={meters(state.world)}
          layout="strip"
        />
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
            Last 60 s. Requests turned away by a full line or a dead server.
          </p>
        </section>
      </div>

      {lb?.kind === 'loadBalancer' && servers[0] && (
        <p className="facts muted">
          Each server finishes{' '}
          <NumberTag entry={servers[0].capacity}>{servers[0].capacity.value} req/s</NumberTag>. The
          load balancer adds{' '}
          <NumberTag entry={lb.baseLatencyMs}>{lb.baseLatencyMs.value} ms</NumberTag> and checks
          every server's health; it takes{' '}
          <NumberTag entry={lb.healthCheckSeconds}>{lb.healthCheckSeconds.value} s</NumberTag> to
          notice one died or came back.
        </p>
      )}
    </article>
  );
}
