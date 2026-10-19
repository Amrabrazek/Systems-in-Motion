import type { TradeoffCard } from '../../ui/shared/tradeoff';
import type { Diagram, DiagramEdge, DiagramPart } from './diagram';

/** Where a step sends the reader next: a live page, or a plain note on why there isn't one yet. */
export type LiveLink = { topicId: string; label: string } | { comingSoon: string };

export interface ScaleStep {
  id: string;
  /** Short name for the step list. */
  title: string;
  /** The usual name for this move, so readers can search for it. */
  move?: string;
  /** What hurts at the start of this step, in plain words. */
  problem: string;
  /** The fix this step adds. The first step has none: it is where we start. */
  fix?: { name: string; awsTag?: string; card: TradeoffCard };
  /**
   * Where the order is a choice, or the idea links to another topic. The steps are a common
   * path, not a rule, so a step that is often skipped or swapped says so here.
   */
  note?: { text: string; link?: { topicId: string; label: string } };
  diagram: Diagram;
  live: LiveLink;
}

// Parts reused across steps. Each step lists what is on screen, so a step reads on its own.
const users: DiagramPart = { id: 'users', label: 'Users' };
const regionA: DiagramPart = { id: 'regionA', label: 'Region A' };
const lb: DiagramPart = { id: 'lb', label: 'Load balancer' };
const servers: DiagramPart = { id: 'servers', label: 'Servers', copies: 3 };
const cache: DiagramPart = { id: 'cache', label: 'Cache' };
const replicas: DiagramPart = { id: 'replicas', label: 'Read copies', copies: 2 };
const shards: DiagramPart = { id: 'db', label: 'Shards', copies: 3 };
const cdn: DiagramPart = { id: 'cdn', label: 'CDN' };
const queue: DiagramPart = { id: 'queue', label: 'Queue' };
const workers: DiagramPart = { id: 'workers', label: 'Workers', copies: 2 };

const edge = (from: DiagramEdge['from'], to: DiagramEdge['to'], copy = false): DiagramEdge =>
  copy ? { from, to, copy } : { from, to };

const balanced = [edge('users', 'lb'), edge('lb', 'servers')];
const cached = [...balanced, edge('servers', 'cache'), edge('servers', 'db')];
const withCopies = [...cached, edge('servers', 'replicas'), edge('db', 'replicas', true)];
const withCdn = [edge('users', 'cdn'), ...withCopies];
const withQueue = [
  ...withCdn,
  edge('servers', 'queue'),
  edge('queue', 'workers'),
  edge('workers', 'db'),
];

export const steps: ScaleStep[] = [
  {
    id: 'one-server',
    title: 'One server',
    problem:
      'Every user talks to one server, and it talks to one database. More users means more work than one server can finish: requests wait in line, then get turned away.',
    diagram: {
      parts: [users, regionA, { id: 'servers', label: 'Server' }, { id: 'db', label: 'Database' }],
      edges: [edge('users', 'servers'), edge('servers', 'db')],
      limit: { part: 'servers', word: 'full' },
    },
    live: { topicId: 'one-server', label: 'Fill one server' },
  },
  {
    id: 'scale-up',
    title: 'Bigger server',
    move: 'Scale up (vertical scaling)',
    problem: 'The server is full.',
    fix: {
      name: 'Bigger server',
      awsTag: 'EC2 size',
      card: {
        fixes: 'A machine with more CPU and memory finishes more requests. No code changes.',
        cost: { from: 'cheap', to: 'medium' },
        complexity: 'Almost none: same setup on a bigger machine, usually after a restart.',
        newRisk: 'Still one server. If it dies, everything is down.',
        breaksNext:
          'There is a biggest machine you can buy, and near the top the price grows faster than the power.',
      },
    },
    diagram: {
      parts: [
        users,
        regionA,
        { id: 'servers', label: 'Bigger server', big: true },
        { id: 'db', label: 'Database' },
      ],
      edges: [edge('users', 'servers'), edge('servers', 'db')],
      limit: { part: 'servers', word: 'ceiling' },
    },
    live: { comingSoon: 'No level of its own: it is the one server with a higher limit.' },
  },
  {
    id: 'scale-out',
    title: 'More servers',
    move: 'Scale out (horizontal scaling)',
    problem: 'One machine can only grow so far, and it is a single point of failure.',
    fix: {
      name: 'Load balancer + more servers',
      awsTag: 'ELB',
      card: {
        fixes: 'Several servers share the work, and you can keep adding more.',
        cost: 'medium',
        complexity:
          'A load balancer to run. Servers can’t keep user data in memory, since any of them may get the next request.',
        newRisk: 'A dead server keeps getting requests until a health check notices.',
        breaksNext: 'Every server still uses the one database. Now it is the slowest part.',
      },
    },
    note: { text: 'Many teams skip the bigger server and start here.' },
    diagram: {
      parts: [users, regionA, lb, servers, { id: 'db', label: 'Database' }],
      edges: [...balanced, edge('servers', 'db')],
      limit: { part: 'db', word: 'full' },
    },
    live: { topicId: 'load-balancer', label: 'Kill a server' },
  },
  {
    id: 'cache',
    title: 'Cache',
    move: 'Caching',
    problem: 'The database is the slowest part, and most requests ask for the same few things.',
    fix: {
      name: 'Cache in front of the database',
      awsTag: 'ElastiCache',
      card: {
        fixes: 'Popular answers are kept in fast memory, so most reads never reach the database.',
        cost: 'medium',
        complexity: 'You decide what to keep and when a kept answer is too old.',
        newRisk:
          'Users can see old data. If the cache restarts empty, every request hits the database at once.',
        breaksNext: 'Reads the cache misses, and every write, still land on one database.',
      },
    },
    note: {
      text: 'Not a must-do first. If reads must always be fresh, read copies may fit better.',
    },
    diagram: {
      parts: [users, regionA, lb, servers, cache, { id: 'db', label: 'Database' }],
      edges: cached,
      limit: { part: 'db', word: 'full' },
    },
    live: { topicId: 'cache', label: 'Kill the cache' },
  },
  {
    id: 'read-replicas',
    title: 'Read copies',
    move: 'Read replicas',
    problem: 'Too many reads still reach the database.',
    fix: {
      name: 'Read replicas',
      awsTag: 'RDS replica',
      card: {
        fixes: 'Copies of the database answer reads, so the main one has less to do.',
        cost: { from: 'medium', to: 'expensive' },
        complexity: 'The app sends reads to the copies and writes to the main database.',
        newRisk: 'Copies lag behind: a user may not see what they just saved.',
        breaksNext: 'Every write still goes to one main database. Write-heavy apps fill it up.',
      },
    },
    note: {
      text: 'You can add read copies without a cache. The picture keeps the cache only because this path added it first.',
    },
    diagram: {
      parts: [users, regionA, lb, servers, cache, { id: 'db', label: 'Main database' }, replicas],
      edges: withCopies,
      limit: { part: 'db', word: 'writes' },
    },
    live: { comingSoon: 'Live level coming: Read replicas (topic 5).' },
  },
  {
    id: 'sharding',
    title: 'Split the data',
    move: 'Sharding',
    problem: 'One main database can’t take all the writes.',
    fix: {
      name: 'Sharding',
      card: {
        fixes:
          'The data is split by a key (say, user ID) across several databases. Each one takes only its part of the writes.',
        cost: 'expensive',
        complexity:
          'High: every query must know which shard holds its data, and moving data between shards is hard.',
        newRisk: 'One very busy key, like a celebrity account, can overload its shard alone.',
        breaksNext:
          'Users far away still wait for every image and script to travel across the world.',
      },
    },
    diagram: {
      parts: [users, regionA, lb, servers, cache, shards, replicas],
      edges: withCopies,
      limit: { part: 'users', word: 'far away' },
    },
    live: { comingSoon: 'Live lab coming: Sharding & hot keys (topic 13).' },
  },
  {
    id: 'cdn',
    title: 'CDN',
    move: 'Content delivery network · edge cache',
    problem: 'Far-away users wait for files that never change.',
    fix: {
      name: 'CDN for files',
      awsTag: 'CloudFront',
      card: {
        fixes:
          'Copies of images, scripts and videos sit on servers near users. They arrive fast and never touch your servers.',
        cost: 'cheap',
        complexity: 'Low for files. You must clear old copies when a file changes.',
        newRisk: 'Users can get an old file until its copy expires.',
        breaksNext:
          'Slow jobs, like sending email or resizing video, still hold a server while the user waits.',
      },
    },
    note: {
      text: 'A CDN is a cache kept near users. It speeds up files only; live data still travels far (see Second region).',
      link: { topicId: 'cache', label: 'How a cache works' },
    },
    diagram: {
      parts: [users, regionA, cdn, lb, servers, cache, shards, replicas],
      edges: withCdn,
      limit: { part: 'servers', word: 'slow jobs' },
    },
    live: { comingSoon: 'Live level coming: CDN & files (topic 7).' },
  },
  {
    id: 'async',
    title: 'Queue slow work',
    move: 'Asynchronous processing',
    problem: 'Slow jobs keep servers busy while users wait.',
    fix: {
      name: 'Queue + workers',
      awsTag: 'SQS',
      card: {
        fixes:
          'The server drops slow jobs in a queue and answers right away. Workers do the jobs in the background.',
        cost: 'cheap',
        complexity:
          'Jobs finish later, so the app must show “in progress” and retry jobs that fail.',
        newRisk:
          'A job can run twice or get stuck, and the queue can grow quietly if workers fall behind.',
        breaksNext:
          'Traffic swings through the day. A fixed number of servers is too few at the peak and wasted at night.',
      },
    },
    diagram: {
      parts: [users, regionA, cdn, lb, servers, cache, shards, replicas, queue, workers],
      edges: withQueue,
      limit: { part: 'servers', word: 'fixed count' },
    },
    live: { comingSoon: 'Live level coming: Queues & async jobs (topic 6).' },
  },
  {
    id: 'autoscaling',
    title: 'Autoscaling',
    move: 'Autoscaling',
    problem: 'Load changes all day, but the number of servers doesn’t.',
    fix: {
      name: 'Autoscaling',
      awsTag: 'Auto Scaling',
      card: {
        fixes: 'Servers are added when busy and removed when quiet, so you pay for what you use.',
        cost: 'cheap',
        complexity:
          'Servers must start fast and keep no user data. You tune when to add and remove.',
        newRisk: 'New servers take time to start. A sudden spike lands before they are ready.',
        breaksNext:
          'Everything lives in one region. If the region goes down, so does the app, and far users are still slow.',
      },
    },
    diagram: {
      parts: [
        users,
        regionA,
        cdn,
        lb,
        { ...servers, label: 'Servers (auto)', elastic: true },
        cache,
        shards,
        replicas,
        queue,
        { ...workers, elastic: true },
      ],
      edges: withQueue,
      limit: { part: 'regionA', word: 'only one' },
    },
    live: { comingSoon: 'Live level coming: Autoscaling (topic 4).' },
  },
  {
    id: 'multi-region',
    title: 'Second region',
    move: 'Multi-region',
    problem: 'One region is one place to fail, and it is far from some users.',
    fix: {
      name: 'Second region',
      card: {
        fixes:
          'A full copy of the system runs in another region. Users go to the nearest one, and if one fails the other takes over.',
        cost: 'expensive',
        complexity:
          'Highest: data is copied between regions, and you decide who wins when two copies disagree.',
        newRisk: 'Copies across the world lag, so two users can briefly see different data.',
        breaksNext:
          'No easy fix is left. From here every choice trades speed, cost, and keeping data the same everywhere (consistency).',
      },
    },
    diagram: {
      parts: [
        users,
        regionA,
        cdn,
        lb,
        { ...servers, label: 'Servers (auto)', elastic: true },
        cache,
        shards,
        replicas,
        queue,
        { ...workers, elastic: true },
        { id: 'regionB', label: 'Region B: full copy' },
      ],
      edges: [...withQueue, edge('users', 'regionB')],
      limit: { part: 'db', word: 'copies lag' },
    },
    live: { comingSoon: 'Live level coming: Multi-region (topic 9).' },
  },
];
