import type { Sim, SimSnapshot } from '../../sim';

const speeds = [
  { value: 0.25, label: 'Slow-mo' },
  { value: 1, label: '1×' },
  { value: 4, label: '4×' },
];

/** Pause / speed / reset for any page that runs a sim. */
export function SimControls({
  sim,
  snapshot,
  onReset,
}: {
  sim: Sim;
  snapshot: SimSnapshot;
  onReset: () => void;
}) {
  return (
    <div className="sim-controls">
      <button
        type="button"
        className="button button--primary"
        onClick={() => (snapshot.paused ? sim.resume() : sim.pause())}
      >
        {snapshot.paused ? '▶ Play' : '❚❚ Pause'}
      </button>
      <div className="segmented" role="group" aria-label="Speed">
        {speeds.map((speed) => (
          <button
            key={speed.value}
            type="button"
            className="button"
            aria-pressed={snapshot.speed === speed.value}
            onClick={() => sim.setSpeed(speed.value)}
          >
            {speed.label}
          </button>
        ))}
      </div>
      <button type="button" className="button" onClick={onReset}>
        ↺ Reset
      </button>
    </div>
  );
}
