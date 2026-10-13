import { getNumber } from '../../data/numbers';
import { survivesLosingOne, type Health, type World } from '../../engine';
import type { Cost } from './tradeoff';

/**
 * One row of the "right now" strip on the tradeoff card. Three steps, never a percent: cost is
 * relative only, and a smooth bar would claim a precision we don't have.
 * More filled steps always means "heavier" (more to pay, more to run, more at risk), so a
 * reader learns one direction for every meter.
 */
export interface Meter {
  label: string;
  level: 1 | 2 | 3;
  /** Shown beside the steps: color is never the only signal. */
  word: string;
  /** 'neutral' for design facts, a health look for risk. */
  look: 'neutral' | Health;
  /** Moves with the sim (users, kills), not only with the design. */
  live: boolean;
  /** One plain sentence on why it reads this way. */
  why: string;
}

const servers = (world: World) => world.nodes.filter((node) => node.kind === 'server');
const hasLoadBalancer = (world: World) => world.nodes.some((node) => node.kind === 'loadBalancer');

export function costLevel(world: World): Cost {
  // Dead servers still count: a killed box is still on the bill.
  const count = servers(world).length;
  if (count >= getNumber('teaching', 'cost.expensiveFromServers').value) return 'expensive';
  if (count >= getNumber('teaching', 'cost.mediumFromServers').value) return 'medium';
  return 'cheap';
}

const costSteps: Record<Cost, Meter['level']> = { cheap: 1, medium: 2, expensive: 3 };

export function costMeter(world: World): Meter {
  const level = costLevel(world);
  const count = servers(world).length;
  return {
    label: 'Cost',
    level: costSteps[level],
    word: level,
    look: 'neutral',
    live: false,
    why: `${count === 1 ? 'One server' : `${count} servers`}${hasLoadBalancer(world) ? ' and a load balancer' : ''} to pay for.`,
  };
}

/** M2 only has two levels of moving parts; "high" waits for caches, queues, more regions. */
export function complexityMeter(world: World): Meter {
  return hasLoadBalancer(world)
    ? {
        label: 'Complexity',
        level: 2,
        word: 'medium',
        look: 'neutral',
        live: false,
        why: 'A load balancer to run, and servers must not keep user data in memory.',
      }
    : {
        label: 'Complexity',
        level: 1,
        word: 'low',
        look: 'neutral',
        live: false,
        why: 'One box to run.',
      };
}

export function lossMeter(world: World): Meter {
  const label = 'If 1 server dies';
  switch (survivesLosingOne(world)) {
    case 'yes':
      return {
        label,
        level: 1,
        word: '✓ holds',
        look: 'ok',
        live: true,
        why: 'The others have room to carry its load.',
      };
    case 'tight':
      return {
        label,
        level: 2,
        word: '~ tight',
        look: 'warn',
        live: true,
        why: 'The others can carry its load, but they get busy and slow.',
      };
    case 'no':
      return {
        label,
        level: 3,
        word: '! fails',
        look: 'bad',
        live: true,
        why: 'The others cannot carry its load. Requests will fail.',
      };
  }
}

/** The three meters the Flow kit topics show: what you pay, what you run, what you risk. */
export const meters = (world: World): Meter[] => [
  costMeter(world),
  complexityMeter(world),
  lossMeter(world),
];
