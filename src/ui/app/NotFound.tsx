import { Link } from 'react-router';

export function NotFound() {
  return (
    <section className="placeholder">
      <h1>Page not found</h1>
      <p>
        <Link to="/">Back to home</Link>
      </p>
    </section>
  );
}
