import { useParams } from 'react-router';

// Deep dives (src/parts/*.md) arrive in v1.5. See docs/navigation.md.
export function PartPage() {
  const { partId } = useParams();
  return (
    <section className="placeholder">
      <h1>Deep dive: {partId}</h1>
      <p>Coming in v1.5.</p>
    </section>
  );
}
