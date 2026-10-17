import type { TradeoffCard } from '../../ui/shared/tradeoff';

/** The cache lesson in five rows. Numbers stay on the stage, where they carry their tag. */
export const addCacheCard: TradeoffCard = {
  fixes: 'Popular answers are kept in fast memory, so most reads never reach the database.',
  cost: { from: 'medium', to: 'expensive' },
  complexity: 'One more box to run, and you decide how old a kept answer is allowed to be.',
  newRisk:
    'Users can see old answers. If the cache dies or restarts empty, every read hits the database at once.',
  breaksNext:
    'The database still has to carry every read the cache misses. If it can’t carry them all, a cache restart takes it down.',
};
