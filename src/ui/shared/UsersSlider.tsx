import { useId } from 'react';
import { positionToValue, usersScale, type LogScale } from './logScale';

/**
 * Controlled by slider position, not by users: rounding users to a nice number and mapping back
 * would snap small moves to the same spot, so arrow keys could get stuck.
 */
export function UsersSlider({
  position,
  onChange,
  scale = usersScale,
}: {
  position: number;
  onChange: (position: number) => void;
  /** Learn pages use the default; Design goes higher. */
  scale?: LogScale;
}) {
  const id = useId();
  const users = positionToValue(scale, position).toLocaleString('en-US');
  return (
    <div className="users-slider">
      <label htmlFor={id}>Users</label>
      <input
        id={id}
        type="range"
        min={0}
        max={scale.steps}
        value={position}
        aria-valuetext={`${users} users`}
        onChange={(event) => onChange(Number(event.target.value))}
      />
      <output htmlFor={id} className="number-value">
        {users}
      </output>
    </div>
  );
}
