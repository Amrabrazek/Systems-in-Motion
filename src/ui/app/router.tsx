import { createHashRouter } from 'react-router';
import { PageShell } from '../shared/PageShell';
import { Home } from './Home';
import { NotFound } from './NotFound';
import { PartPage } from './PartPage';
import { TopicRoute } from './TopicRoute';

// Hash URLs (#/learn/x) work on GitHub Pages and inside PR preview subfolders (ADR 0008).
export const router = createHashRouter([
  {
    element: <PageShell />,
    children: [
      { index: true, element: <Home /> },
      // No separate topic map yet: Learn shows Home's topic list.
      { path: 'learn', element: <Home /> },
      { path: 'learn/:topicId', element: <TopicRoute /> },
      { path: 'parts/:partId', element: <PartPage /> },
      {
        path: 'design',
        lazy: async () => ({ Component: (await import('../../design/DesignPage')).default }),
      },
      { path: '*', element: <NotFound /> },
    ],
  },
]);
