import { useId, useState } from 'react';
import { NumberTag } from '../ui/shared/NumberTag';
import type { BuilderChange } from './builder';
import { partsFor, type NumberRow, type PartId } from './numbers';
import { defaultNumber, numberFor, overrideProblem, type DesignSpec } from './spec';

/** Your own numbers, one part at a time (docs/milestones/m4-design-v0.md, step 4). */
export function NumbersPanel({
  spec,
  open,
  onOpen,
  onChange,
}: {
  spec: DesignSpec;
  open: PartId;
  onOpen: (part: PartId) => void;
  onChange: (change: BuilderChange) => void;
}) {
  const shown = partsFor(spec);
  // A part you just removed (cache off) falls back to the first tab.
  const current = shown.find((part) => part.id === open) ?? shown[0];
  return (
    <section className="panel numbers-panel" aria-label="Numbers">
      <h2>Numbers</h2>
      <div className="segmented numbers-tabs" role="group" aria-label="Part">
        {shown.map((part) => (
          <button
            key={part.id}
            type="button"
            className="button"
            aria-pressed={part.id === current?.id}
            onClick={() => onOpen(part.id)}
          >
            {part.title}
          </button>
        ))}
      </div>
      {current?.rows.map((row) => (
        <NumberInput
          // Keyed by value: a change from outside (reset, size toggle) starts a fresh draft.
          key={`${row.key}-${numberFor(spec, row.key).value}`}
          spec={spec}
          row={row}
          onChange={onChange}
        />
      ))}
      <p className="build-note muted">
        Press Enter or leave the box to apply. Your numbers show <strong>U</strong>.
      </p>
    </section>
  );
}

function NumberInput({
  spec,
  row,
  onChange,
}: {
  spec: DesignSpec;
  row: NumberRow;
  onChange: (change: BuilderChange) => void;
}) {
  const id = useId();
  const entry = numberFor(spec, row.key);
  const [draft, setDraft] = useState(String(entry.value));
  const [error, setError] = useState<string>();

  function apply() {
    const value = draft.trim() === '' ? Number.NaN : Number(draft);
    const problem = overrideProblem(row.key, value);
    setError(problem);
    if (!problem) onChange({ type: 'setOverride', key: row.key, value });
  }

  const isYours = entry.tag === 'U';
  return (
    <div className="number-row">
      <label htmlFor={id}>
        {row.label}
        <small className="muted">{row.definition}</small>
      </label>
      <div className="number-input">
        <input
          id={id}
          type="number"
          inputMode="decimal"
          min={0}
          value={draft}
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? `${id}-error` : undefined}
          onChange={(event) => setDraft(event.target.value)}
          onBlur={apply}
          onKeyDown={(event) => {
            if (event.key === 'Enter') apply();
          }}
        />
        <NumberTag entry={entry}>{entry.unit}</NumberTag>
        {isYours && (
          <button
            type="button"
            className="button button--small"
            aria-label={`Reset ${row.label} to ${defaultNumber(spec, row.key).value}`}
            onClick={() => onChange({ type: 'setOverride', key: row.key, value: undefined })}
          >
            ↺
          </button>
        )}
      </div>
      {error && (
        <p id={`${id}-error`} className="number-error" role="alert">
          ! {error}
        </p>
      )}
    </div>
  );
}
