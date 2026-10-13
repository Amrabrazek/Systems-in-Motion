import { NavLink, Outlet } from 'react-router';

const legend = [
  { tag: 'M', label: 'Measured' },
  { tag: 'R', label: 'Rule of thumb' },
  { tag: 'T', label: 'Teaching guess' },
  { tag: 'U', label: 'Yours' },
] as const;

// Every page shares this shell: top bar (Home · Learn · Design) and the number-tag legend.
export function PageShell() {
  return (
    <div className="shell">
      <header className="topbar">
        <span className="brand">Systems in Motion</span>
        <nav aria-label="Main">
          <NavLink to="/" end>
            Home
          </NavLink>
          <NavLink to="/learn">Learn</NavLink>
          <NavLink to="/design">Design</NavLink>
        </nav>
        <p className="legend" aria-label="Number tags">
          {legend.map(({ tag, label }, index) => (
            <span key={tag}>
              {index > 0 && ' · '}
              <abbr title={label}>{tag}</abbr> {label}
            </span>
          ))}
        </p>
      </header>
      <main>
        <Outlet />
      </main>
    </div>
  );
}
