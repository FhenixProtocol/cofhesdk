/**
 * Test-only wrapper around the real zkProve worker.
 *
 * tfhe's rayon threads are Web Workers that the zkProve worker creates itself,
 * so the page never sees them. This wrapper counts them from the inside: it
 * swaps this worker's global `Worker` for a counting subclass, then loads the
 * real `zkProve.worker` into the same global scope. The zkProve protocol is
 * untouched; one extra message type reports the count.
 */

/* eslint-disable no-undef */

const scope = self as any;
const RealWorker = scope.Worker;
let rayonWorkersStarted = 0;

scope.Worker = class extends RealWorker {
  constructor(url: string | URL, options?: WorkerOptions) {
    super(url, options);
    if (String(url).includes('workerHelpers')) rayonWorkersStarted++;
  }
};

scope.addEventListener('message', (event: MessageEvent) => {
  if (event.data?.type !== 'countRayonWorkers') return;
  scope.postMessage({ id: event.data.id, type: 'rayonWorkerCount', count: rayonWorkersStarted });
});

// Loaded after the counting `Worker` is in place. The real worker installs its
// own `onmessage` handler and signals `ready` as usual.
import('../zkProve.worker');
