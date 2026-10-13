import { getNumber } from '../../data/numbers';
import type { World } from '../../engine';

const n = (id: string) => getNumber('teaching', id);

export const START_USERS = 100;

/** Users → one small server. Teaching numbers: it breaks near 1,000 users. */
export function oneServerWorld(users = START_USERS): World {
  return {
    nodes: [
      { id: 'users', kind: 'users', label: 'Users', region: 'region-1', zone: 'zone-a' },
      {
        id: 'server',
        kind: 'server',
        label: 'Server',
        awsTag: 'EC2',
        capacity: n('server.small.capacity'),
        queueMax: n('server.queueMax'),
        baseLatencyMs: n('server.baseLatencyMs'),
        region: 'region-1',
        zone: 'zone-a',
        up: true,
      },
    ],
    edges: [{ id: 'users-server', from: 'users', to: 'server' }],
    traffic: { users, requestsPerUserPerSec: n('traffic.requestsPerUserPerSec') },
    rules: {
      busyAt: n('rules.busyAt'),
      latencyCapAt: n('rules.latencyCapAt'),
      queueBadFraction: n('rules.queueBadFraction'),
      smoothingSeconds: n('rules.smoothingSeconds'),
    },
    seed: 1,
  };
}
