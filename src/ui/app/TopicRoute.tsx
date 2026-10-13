import { Suspense } from 'react';
import { useParams } from 'react-router';
import { findTopic } from '../../topics';
import { NotFound } from './NotFound';

export function TopicRoute() {
  const { topicId = '' } = useParams();
  const topic = findTopic(topicId);
  if (!topic) return <NotFound />;

  return (
    <Suspense fallback={<p className="muted">Loading…</p>}>
      <topic.Page />
    </Suspense>
  );
}
