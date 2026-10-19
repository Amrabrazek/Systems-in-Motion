import { steps } from './steps';

/** One fix the picker offers for a symptom, and when it is the better pick. */
export interface SymptomFix {
  stepId: string;
  pickWhen: string;
}

/**
 * "What's breaking?" picker. The steps are a common path, not a rule: real systems add
 * whatever fixes the part that is breaking now. Each symptom points at one or two steps.
 */
export interface Symptom {
  id: string;
  label: string;
  fixes: SymptomFix[];
}

export const symptoms: Symptom[] = [
  {
    id: 'app-cpu',
    label: 'Servers are full',
    fixes: [
      {
        stepId: 'scale-out',
        pickWhen: 'Most of the time. Servers that keep no user data copy easily.',
      },
      {
        stepId: 'scale-up',
        pickWhen: 'You need a quick win and the app can’t run on many servers yet.',
      },
    ],
  },
  {
    id: 'db-reads',
    label: 'Database reads are slow',
    fixes: [
      { stepId: 'cache', pickWhen: 'The same popular data is read again and again. Cheaper.' },
      {
        stepId: 'read-replicas',
        pickWhen: 'Reads must be fresh, or rarely repeat. Works with or without a cache.',
      },
    ],
  },
  {
    id: 'db-writes',
    label: 'Database writes are slow',
    fixes: [
      {
        stepId: 'async',
        pickWhen: 'Writes can wait a little. Smooth the peaks with a queue first.',
      },
      { stepId: 'sharding', pickWhen: 'There are simply too many writes for one database.' },
    ],
  },
  {
    id: 'far-users',
    label: 'Far-away users are slow',
    fixes: [
      { stepId: 'cdn', pickWhen: 'They wait for files: images, scripts, video.' },
      { stepId: 'multi-region', pickWhen: 'They wait for live, per-user data.' },
    ],
  },
  {
    id: 'slow-jobs',
    label: 'Users wait for slow jobs',
    fixes: [{ stepId: 'async', pickWhen: 'Email, reports, video: work the user needn’t watch.' }],
  },
  {
    id: 'spiky',
    label: 'Traffic swings a lot',
    fixes: [{ stepId: 'autoscaling', pickWhen: 'Busy peaks and quiet nights.' }],
  },
];

/** Where a fix lives in the stepper. -1 means no such step (tests keep that from shipping). */
export function stepIndexFor(stepId: string): number {
  return steps.findIndex((step) => step.id === stepId);
}
