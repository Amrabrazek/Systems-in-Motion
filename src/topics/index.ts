import { lazy, type ComponentType, type LazyExoticComponent } from 'react';

export interface TopicInfo {
  id: string; // URL slug: #/learn/<id>
  title: string;
  kit: 'flow' | 'data-layout' | 'time-and-copies' | 'algorithm';
  page: 'level' | 'lab';
  status: 'building' | 'ready';
  // Lazy so adding topic 20 doesn't slow down topic 1 (docs/navigation.md).
  Page: LazyExoticComponent<ComponentType>;
}

// One line per topic, in roadmap order. The only shared file a topic PR touches.
export const topics: TopicInfo[] = [
  {
    id: 'one-server',
    title: 'One server',
    kit: 'flow',
    page: 'level',
    status: 'building',
    Page: lazy(() => import('./one-server/page')),
  },
];

export function findTopic(id: string): TopicInfo | undefined {
  return topics.find((topic) => topic.id === id);
}
