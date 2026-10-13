import type { TradeoffCard } from '../../ui/shared/tradeoff';

/** The M2 lesson in five rows. Numbers stay on the stage, where they carry their tag. */
export const addLoadBalancerCard: TradeoffCard = {
  fixes: 'One server is full. Two servers share the load, so each one is less busy.',
  cost: { from: 'cheap', to: 'medium' },
  complexity:
    'A new box to run. Servers must not keep user data in memory, since any of them can get the next request.',
  newRisk:
    'When a server dies, the load balancer keeps sending to it until a health check notices. Those requests fail.',
  breaksNext:
    'Two servers is not redundancy: lose one and the other must carry everything. You need a spare (N+1).',
};
