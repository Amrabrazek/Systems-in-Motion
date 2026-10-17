import { useEffect, useId, useState } from 'react';
import { getNumber } from '../../data/numbers';
import { DotLayer } from '../../kits/flow/DotLayer';
import { FlowStage } from '../../kits/flow/FlowStage';
import { lookText } from '../../kits/flow/health';
import { whyForState } from '../../kits/flow/why';
import { browserClock, createSim, useSim } from '../../sim';
import { LiveChart } from '../../ui/shared/LiveChart';
import { positionToValue, usersScale, valueToPosition } from '../../ui/shared/logScale';
import { NumberTag } from '../../ui/shared/NumberTag';
import { SimControls } from '../../ui/shared/SimControls';
import { TradeoffCard } from '../../ui/shared/TradeoffCard';
import type { TradeoffLink } from '../../ui/shared/tradeoff';
import { UsersSlider } from '../../ui/shared/UsersSlider';
import { availableLinks, highlightFor, linkForNode } from './links';
import { cacheMeters } from './meters';
import { addCacheCard } from './tradeoff';
import {
  cacheOf,
  cacheWorld,
  databaseOf,
  MAX_TTL_SECONDS,
  START_USERS,
  TTL_STEP_SECONDS,
  withCache,
  withTtl,
} from './world';
import './page.css';

const feelsSlow = getNumber('teaching', 'ux.feelsSlowMs');
const latencySteps = [200, 500, 1000, 2000, 5000];
const errorSteps = [10, 20, 50, 100];
const formatMs = (ms: number) =>
  ms >= 1000 ? `${(ms / 1000).toFixed(1)} s` : `${Math.round(ms)} ms`;
const formatPercent = (percent: number) => `${Math.round(percent)}%`;

export default function CachePage() {
  const [sim] = useState(() => createSim(cacheWorld(), browserClock));
  const [position, setPosition] = useState(() => valueToPosition(usersScale, START_USERS));
  const snapshot = useSim(sim);
  const [activeLink, setActiveLink] = useState<TradeoffLink>();
  const ttlId = useId();

  useEffect(() => {
    sim.start();
    return () => sim.stop();
  }, [sim]);

  const { state } = snapshot;
  // Read from the sim, not React state, so Reset can never leave the controls out of date.
  const cache = cacheOf(state.world);
  const database = databaseOf(state.world);
  const why = whyForState(state);
  const highlight = highlightFor(state.world, activeLink);

  function moveSlider(next: number) {
    setPosition(next);
    sim.dispatch({ type: 'setUsers', users: positionToValue(usersScale, next) });
  }

  function toggleCache() {
    setActiveLink(undefined);
    sim.dispatch({ type: 'replaceWorld', world: withCache(state.world, !cache) });
  }

  function setTtl(seconds: number) {
    sim.dispatch({ type: 'replaceWorld', world: withTtl(state.world, seconds) });
  }

  function reset() {
    setActiveLink(undefined);
    setPosition(valueToPosition(usersScale, START_USERS));
    sim.reset();
  }

  return (
    <article className="topic">
      <h1>Cache</h1>
      <p className="muted">
        The servers are fine, but the database is full. A cache keeps popular answers in memory so
        most reads never reach the database. Add one, change how long it keeps answers, then kill it
        and watch it come back empty.
      </p>

      <section className="panel stage-panel" aria-label="Live system">
        <div className="stage">
          <FlowStage
            state={state}
            dots={<DotLayer sim={sim} />}
            {...(highlight ? { highlight } : {})}
            onPointNode={(id) => setActiveLink(id ? linkForNode(state.world, id) : undefined)}
          />
        </div>
        <div className="panel-row controls-row">
          <UsersSlider position={position} onChange={moveSlider} />
          <SimControls sim={sim} snapshot={snapshot} onReset={reset} />
        </div>
        <div className="panel-row cache-controls">
          <button type="button" className="button" onClick={toggleCache}>
            {cache ? '− Remove the cache' : '+ Add a cache'}
          </button>
          {cache &&
            (cache.up ? (
              <button
                type="button"
                className="button button--kill"
                onClick={() => sim.dispatch({ type: 'killNode', nodeId: cache.id })}
              >
                ✕ Kill the cache
              </button>
            ) : (
              <button
                type="button"
                className="button button--revive"
                onClick={() => sim.dispatch({ type: 'reviveNode', nodeId: cache.id })}
              >
                ↺ Revive the cache
              </button>
            ))}
          {cache && (
            <div className="ttl-slider">
              <label htmlFor={ttlId}>Keep answers for (TTL)</label>
              <input
                id={ttlId}
                type="range"
                min={0}
                max={MAX_TTL_SECONDS}
                step={TTL_STEP_SECONDS}
                value={cache.ttlSeconds.value}
                aria-valuetext={`${cache.ttlSeconds.value} seconds`}
                onChange={(event) => setTtl(Number(event.target.value))}
              />
              <NumberTag entry={cache.ttlSeconds}>{cache.ttlSeconds.value} s</NumberTag>
              <span className="ttl-staleness muted">
                {cache.ttlSeconds.value === 0
                  ? 'Every answer is fresh, and nothing is kept.'
                  : `Users may see answers up to ${cache.ttlSeconds.value} s old.`}
              </span>
            </div>
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
        {/* The tradeoffs live in the same panel as the system they describe (design system part 5). */}
        <TradeoffCard
          name="Cache in front of the database"
          awsTag="ElastiCache"
          card={addCacheCard}
          meters={cacheMeters(state.world)}
          layout="strip"
          link={{
            active: activeLink,
            available: availableLinks(state.world),
            onChange: setActiveLink,
          }}
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
          <p className="chart-foot">Last 60 s. Requests turned away by a full database.</p>
        </section>
      </div>

      {database && (
        <p className="facts muted">
          The database finishes{' '}
          <NumberTag entry={database.capacity}>{database.capacity.value} req/s</NumberTag>, each in{' '}
          <NumberTag entry={database.baseLatencyMs}>{database.baseLatencyMs.value} ms</NumberTag>{' '}
          when idle.
          {cache && (
            <>
              {' '}
              The cache answers from memory in{' '}
              <NumberTag entry={cache.baseLatencyMs}>{cache.baseLatencyMs.value} ms</NumberTag> and
              has no limit here. Users ask for{' '}
              <NumberTag entry={cache.keyCount}>
                {cache.keyCount.value.toLocaleString('en-US')}
              </NumberTag>{' '}
              different things, so more users means each one is asked more often and kept answers
              get used more.
            </>
          )}{' '}
          The picture shows the cache in the path (read-through); many apps instead ask the cache
          first and the database on a miss (cache-aside). The load on each box is the same.
        </p>
      )}
    </article>
  );
}
