import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { THREADPOOL_TESTS, fetchNetworkKeys } from './threadPoolBenchHelper';

// What happens when the zkProve worker receives two proof requests before it
// has finished initializing tfhe — e.g. an app doing
// `Promise.all([encrypt(a), encrypt(b)])` as its first encryption?
//
// `initThreadPool` may only run once per wasm instance. It spawns its N rayon
// workers first and only then builds rayon's global pool, so a second call
// spawns N more workers, fails at the build step, and leaves those N stranded
// for the lifetime of the zkProve worker.
//
// The rayon workers are created inside the zkProve worker, out of the page's
// sight, so this test runs the real worker inside `countingZkProveWorker`,
// which counts them from the inside.

const THREADS = 2;

type WorkerReply = { id: string; type: string; error?: string; count?: number };

describe.skipIf(!THREADPOOL_TESTS)('@cofhe/sdk/web - zkProve worker init race', () => {
  let worker: Worker;
  let keys: { fheKey: string; crs: string };
  let replies: WorkerReply[];
  let rayonWorkersStarted: number;

  const request = (message: Record<string, unknown>) =>
    new Promise<WorkerReply>((resolve) => {
      worker.addEventListener('message', function onReply(event: MessageEvent) {
        if (event.data?.id !== message.id) return;
        worker.removeEventListener('message', onReply);
        resolve(event.data);
      });
      worker.postMessage(message);
    });

  const prove = (id: string, value: number) =>
    request({
      id,
      type: 'zkProve',
      fheKeyHex: keys.fheKey,
      crsHex: keys.crs,
      items: [{ utype: 'uint32', data: String(value) }],
      metadata: Array.from(new Uint8Array(32).fill(7)),
      tfheThreads: THREADS,
    });

  beforeAll(async () => {
    keys = await fetchNetworkKeys();

    worker = new Worker(new URL('./countingZkProveWorker.ts', import.meta.url), { type: 'module' });
    await new Promise<void>((resolve, reject) => {
      worker.addEventListener('message', function onReady(event: MessageEvent) {
        if (event.data?.type !== 'ready') return;
        worker.removeEventListener('message', onReady);
        resolve();
      });
      worker.addEventListener('error', (event) => reject(new Error(`worker failed to load: ${event.message}`)));
    });

    // Both requests are posted before the worker can finish its first init.
    replies = await Promise.all([prove('race-a', 1), prove('race-b', 2)]);

    rayonWorkersStarted = (await request({ id: 'count', type: 'countRayonWorkers' })).count ?? -1;
  }, 240000);

  afterAll(() => worker?.terminate());

  it('generates both proofs', () => {
    expect(globalThis.crossOriginIsolated).toBe(true);
    expect(replies.map((reply) => reply.type)).toEqual(['success', 'success']);
  });

  // The worker memoises its in-flight init, so the second request waits for the
  // first one's pool instead of starting another.
  it('starts exactly one rayon pool', () => {
    expect(rayonWorkersStarted).toBe(THREADS);
  });
});
