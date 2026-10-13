import { useId } from 'react';
import { positionToValue, usersScale } from './logScale';

/**
 * Controlled by slider position, not by users: rounding users to a nice number and mapping back
 * would snap small moves to the same spot, so arrow keys could get stuck.
 */
export function UsersSlider({
  position,
  onChange,
}: {
  position: number;
  onChange: (position: number) => void;
}) {
  const id = useId();
  const users = positionToValue(usersScale, position).toLocaleString('en-US');
  return (
    <div className="users-slider">
      <label htmlFor={id}>Users</label>
      <input
        id={id}
        type="range"
        min={0}
        max={usersScale.steps}
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
