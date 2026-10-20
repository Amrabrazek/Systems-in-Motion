import { useEffect, useState } from 'react';
import { getNumber } from '../data/numbers';
import type { CacheNode, WorkNode, World } from '../engine';
import { DotLayer } from '../kits/flow/DotLayer';
import { FlowStage } from '../kits/flow/FlowStage';
import { lookText } from '../kits/flow/health';
import { whyForState } from '../kits/flow/why';
import { browserClock, createSim, useSim } from '../sim';
import { LiveChart } from '../ui/shared/LiveChart';
import { positionToValue, valueToPosition, type LogScale } from '../ui/shared/logScale';
import { NumberTag } from '../ui/shared/NumberTag';
import { SimControls } from '../ui/shared/SimControls';
import { UsersSlider } from '../ui/shared/UsersSlider';
import { applyChange, keepLiveState, startBuilder, type BuilderChange } from './builder';
import { MAX_SERVERS, MAX_USERS, defaultSpec, specToWorld } from './spec';
import './page.css';

// Design mode v0, step 3: build a chain, run it, kill parts (docs/milestones/m4-design-v0.md).
// Your own numbers (step 4) and the breaking point + share link (step 5) come next.

/** Design goes past Learn's 10,000 users: engineers size for real traffic. */
const designUsersScale: LogScale = { min: 10, max: MAX_USERS, steps: 400 };

const feelsSlow = getNumber('teaching', 'ux.feelsSlowMs');
const latencySteps = [200, 500, 1000, 2000, 5000];
const errorSteps = [10, 20, 50, 100];
const formatMs = (ms: number) =>
  ms >= 1000 ? `${(ms / 1000).toFixed(1)} s` : `${Math.round(ms)} ms`;
const formatPercent = (percent: number) => `${Math.round(percent)}%`;

const serversOf = (world: World) =>
  world.nodes.filter((node): node is WorkNode => node.kind === 'server');
const cacheOf = (world: World) =>
  world.nodes.find((node): node is CacheNode => node.kind === 'cache');

export default function DesignPage() {
  const [builder, setBuilder] = useState(() => startBuilder(defaultSpec));
  const [sim] = useState(() => createSim(specToWorld(defaultSpec), browserClock));
  const [position, setPosition] = useState(() =>
    valueToPosition(designUsersScale, defaultSpec.users),
  );
  const snapshot = useSim(sim);

  useEffect(() => {
    sim.start();
    return () => sim.stop();
  }, [sim]);

  const { state } = snapshot;
  const { spec } = builder;
  const servers = serversOf(state.world);
  const cache = cacheOf(state.world);
  const why = whyForState(state);
  const firstServer = servers[0];

  function change(next: BuilderChange) {
    const updated = applyChange(builder, next);
    setBuilder(updated);
    // Read the live world from the sim, not React state, so kills made a frame ago carry over.
    const world = keepLiveState(specToWorld(updated.spec), sim.getState().world);
    sim.dispatch({ type: 'replaceWorld', world });
  }

  function moveSlider(next: number) {
    setPosition(next);
    const users = positionToValue(designUsersScale, next);
    setBuilder((current) => applyChange(current, { type: 'setUsers', users }));
    sim.dispatch({ type: 'setUsers', users });
  }

  function reset() {
    // Back to time 0 with your design, not the default one.
    sim.reset(specToWorld(spec));
  }

  return (
    <article className="topic design">
      <h1>Design</h1>
      <p className="muted">
        Build your system, put load on it, and kill parts. Watch which box fills up first.
      </p>

      <div className="design-layout">
        <section className="panel build-panel" aria-label="Build">
          <h2>Build</h2>
          <label className="build-row">
            <input
              type="checkbox"
              checked={spec.loadBalancer}
              onChange={(event) => change({ type: 'setLoadBalancer', on: event.target.checked })}
            />
            <span>
              Load balancer
              <small className="muted">Splits requests evenly across the servers.</small>
            </span>
          </label>

          <div className="build-row" role="group" aria-label="Number of servers">
            <span>Servers</span>
            <button
              type="button"
              className="button"
              aria-label="Remove a server"
              disabled={!spec.loadBalancer || spec.servers.count <= 1}
              onClick={() => change({ type: 'setServerCount', count: spec.servers.count - 1 })}
            >
              −
            </button>
            <output className="number-value">{spec.servers.count}</output>
            <button
              type="button"
              className="button"
              aria-label="Add a server"
              disabled={!spec.loadBalancer || spec.servers.count >= MAX_SERVERS}
              onClick={() => change({ type: 'setServerCount', count: spec.servers.count + 1 })}
            >
              +
            </button>
          </div>
          {!spec.loadBalancer && (
            <p className="build-note muted">More than one server needs a load balancer.</p>
          )}

          <div className="build-row" role="group" aria-label="Server size">
            <span>Size</span>
            <div className="segmented">
              {(['small', 'big'] as const).map((size) => (
                <button
                  key={size}
                  type="button"
                  className="button"
                  aria-pressed={spec.servers.size === size}
                  onClick={() => change({ type: 'setServerSize', size })}
                >
                  {size === 'small' ? 'Small' : 'Big'}
                </button>
              ))}
            </div>
          </div>
          {firstServer && (
            <p className="build-note muted">
              Each server finishes{' '}
              <NumberTag entry={firstServer.capacity}>{firstServer.capacity.value} req/s</NumberTag>
              .
            </p>
          )}

          <label className="build-row">
            <input
              type="checkbox"
              checked={spec.cache}
              onChange={(event) => change({ type: 'setCache', on: event.target.checked })}
            />
            <span>
              Cache
              <small className="muted">
                Answers repeat reads from memory, so fewer reach the database. Starts empty.
              </small>
            </span>
          </label>
        </section>

        <section className="panel stage-panel" aria-label="Live system">
          <div className="stage">
            <FlowStage state={state} dots={<DotLayer sim={sim} />} />
          </div>
          <div className="panel-row controls-row">
            <UsersSlider position={position} onChange={moveSlider} scale={designUsersScale} />
            <SimControls sim={sim} snapshot={snapshot} onReset={reset} />
          </div>
          <div className="panel-row kill-switches" role="group" aria-label="Kill or revive a part">
            {[...servers, ...(cache ? [cache] : [])].map((node) =>
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
      </div>

      <div className="charts">
        <section className="panel chart" aria-label="Latency">
          <div className="chart-head">
            <h2>Latency (avg)</h2>
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
            Average time from request to answer, last 60 s. Dashed line: users notice past{' '}
            <NumberTag entry={feelsSlow}>~1 s</NumberTag>
          </p>
        </section>
        <section className="panel chart" aria-label="Error rate">
          <div className="chart-head">
            <h2>Error rate</h2>
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
            Share of requests turned away (full queue or dead box), last 60 s.
          </p>
        </section>
        <section className="panel chart throughput" aria-label="Throughput">
          <div className="chart-head">
            <h2>Throughput (RPS)</h2>
            <span className="chart-now">
              {Math.round(state.smoothed.throughput).toLocaleString('en-US')} req/s
            </span>
          </div>
          <p className="chart-foot">
            Requests per second answered, by the cache or the last box. Sent:{' '}
            {Math.round(
              state.world.traffic.users * state.world.traffic.requestsPerUserPerSec.value,
            ).toLocaleString('en-US')}{' '}
            req/s.
          </p>
        </section>
      </div>
    </article>
  );
}
