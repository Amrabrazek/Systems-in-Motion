import type { NumberEntry } from '../../engine/types';

const queueingTheory = {
  title: 'M/M/1 queue (waiting time grows as 1 / (1 − utilization))',
  url: 'https://en.wikipedia.org/wiki/M/M/1_queue',
  date: '2026-10-13',
};

// Round numbers that make a lesson visible (Learn levels). Values from the One Box Breaks
// prototype; see docs/engine.md "Starting numbers".
export const teaching: NumberEntry[] = [
  {
    id: 'traffic.requestsPerUserPerSec',
    value: 0.1,
    unit: 'req/s per user',
    tag: 'T',
    note: 'One request every 10 s per user.',
  },
  {
    id: 'server.small.capacity',
    value: 80,
    unit: 'req/s',
    tag: 'T',
    note: 'Picked so one server breaks near 1,000 users.',
  },
  {
    id: 'server.queueMax',
    value: 150,
    unit: 'requests',
    tag: 'T',
    note: 'Long enough to watch the waiting line grow.',
  },
  {
    id: 'server.baseLatencyMs',
    value: 50,
    unit: 'ms',
    tag: 'T',
    note: 'A light web request on an idle server.',
  },
  {
    id: 'rules.busyAt',
    value: 0.7,
    unit: 'utilization',
    range: [0.7, 0.8],
    tag: 'R',
    note: 'Past ~70–80% busy, waiting time rises sharply.',
    source: queueingTheory,
  },
  {
    id: 'rules.latencyCapAt',
    value: 0.9,
    unit: 'utilization',
    tag: 'T',
    note: 'Stop the curve here so latency stays finite; the queue term takes over past it.',
  },
  {
    id: 'rules.queueBadFraction',
    value: 0.5,
    unit: 'share of queueMax',
    tag: 'T',
    note: 'A waiting line over half full means the box is failing to keep up.',
  },
  {
    id: 'rules.smoothingSeconds',
    value: 0.4,
    unit: 's',
    tag: 'T',
    note: 'Chart smoothing: steady enough to read, quick enough to feel live.',
  },
];
