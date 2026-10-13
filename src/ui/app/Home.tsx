import { Link } from 'react-router';
import { topics } from '../../topics';

export function Home() {
  return (
    <>
      <h1>Watch software systems behave live</h1>
      <p className="muted">Then change them and see what happens.</p>
      <h2 id="learn">Learn</h2>
      <ul className="cards">
        {topics.map((topic) => (
          <li key={topic.id}>
            <Link className="card" to={`/learn/${topic.id}`}>
              <strong>{topic.title}</strong>
              <br />
              <span className="muted">{topic.status === 'ready' ? 'Ready' : 'Being built'}</span>
            </Link>
          </li>
        ))}
      </ul>
      <h2>Design</h2>
      <p>
        <Link to="/design">Build your own system</Link>
      </p>
    </>
  );
}
