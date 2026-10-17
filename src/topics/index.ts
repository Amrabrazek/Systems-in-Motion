import { lazy, type ComponentType, type LazyExoticComponent } from 'react';

export interface TopicInfo {
  id: string; // URL slug: #/learn/<id>
  title: string;
  kit: 'flow' | 'data-layout' | 'time-and-copies' | 'algorithm' | 'none';
  page: 'level' | 'lab' | 'explainer';
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
  {
    id: 'load-balancer',
    title: 'Load balancer',
    kit: 'flow',
    page: 'level',
    status: 'building',
    Page: lazy(() => import('./load-balancer/page')),
  },
  {
    id: 'cache',
    title: 'Cache',
    kit: 'flow',
    page: 'level',
    status: 'building',
    Page: lazy(() => import('./cache/page')),
  },
  {
    id: 'how-systems-scale',
    title: 'How systems scale',
    kit: 'none',
    page: 'explainer',
    status: 'building',
    Page: lazy(() => import('./how-systems-scale/page')),
  },
];

export function findTopic(id: string): TopicInfo | undefined {
  return topics.find((topic) => topic.id === id);
}
