import { useEffect, useState } from 'react';
import type { WorkNode } from '../../engine';
import { FlowStage } from '../../kits/flow/FlowStage';
import { healthText } from '../../kits/flow/health';
import { whyLine } from '../../kits/flow/why';
import { browserClock, createSim, useSim } from '../../sim';
import { positionToValue, usersScale, valueToPosition } from '../../ui/shared/logScale';
import { NumberTag } from '../../ui/shared/NumberTag';
import { SimControls } from '../../ui/shared/SimControls';
import { UsersSlider } from '../../ui/shared/UsersSlider';
import { oneServerWorld, START_USERS } from './world';

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
  const status = server ? state.nodes[server.id] : undefined;

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
          <FlowStage state={state} />
        </div>
        <div className="panel-row controls-row">
          <UsersSlider position={position} onChange={moveSlider} />
          <SimControls sim={sim} snapshot={snapshot} onReset={reset} />
        </div>
        {server && status && (
          <p className="panel-row why" aria-live="polite">
            <span className={`pill pill--${status.health}`}>{healthText(status.health)}</span>
            <span>
              {whyLine(server, status).map((part, index) =>
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

      {server && (
        <p className="facts muted">
          Each user sends{' '}
          <NumberTag entry={state.world.traffic.requestsPerUserPerSec}>
            {state.world.traffic.requestsPerUserPerSec.value} req/s
          </NumberTag>
          . The server finishes{' '}
          <NumberTag entry={server.capacity}>{server.capacity.value} req/s</NumberTag>. Its waiting
          line holds <NumberTag entry={server.queueMax}>{server.queueMax.value}</NumberTag>{' '}
          requests.
        </p>
      )}
    </article>
  );
}
