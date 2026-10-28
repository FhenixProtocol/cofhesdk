import { describe, it, expect, afterEach, vi } from 'vitest';
import { getWorkerManager, terminateWorker, areWorkersAvailable } from '../workerManager.js';

describe('WorkerManager', () => {
  afterEach(() => {
    // Clean up worker after each test
    terminateWorker();
  });

  describe('areWorkersAvailable', () => {
    it('should return false in Node.js environment', () => {
      // In Node.js/Vitest, workers aren't available
      expect(areWorkersAvailable()).toBe(false);
    });
  });

  describe('getWorkerManager', () => {
    it('should return a singleton instance', () => {
      const manager1 = getWorkerManager();
      const manager2 = getWorkerManager();
      expect(manager1).toBe(manager2);
    });

    it('should create new instance after termination', () => {
      const manager1 = getWorkerManager();
      terminateWorker();
      const manager2 = getWorkerManager();

      // After termination, a new instance should be created
      expect(manager1).toBeDefined();
      expect(manager2).toBeDefined();
      // They should NOT be the same instance anymore
      expect(manager1).not.toBe(manager2);
    });
  });

  describe('submitProof', () => {
    it('should throw immediately when workers not available', async () => {
      if (!areWorkersAvailable()) {
        const manager = getWorkerManager();

        await expect(manager.submitProof('invalid', 'invalid', [], new Uint8Array())).rejects.toThrow(
          'Web Workers not supported'
        );
      }
    });
  });

  describe('terminateWorker', () => {
    it('should clean up worker instance and allow getting a new one', () => {
      const manager1 = getWorkerManager();
      expect(manager1).toBeDefined();

      // Terminate the worker
      terminateWorker();

      // After termination, should be able to get a new instance
      const manager2 = getWorkerManager();
      expect(manager2).toBeDefined();

      // The new instance should be different from the terminated one
      expect(manager2).not.toBe(manager1);
    });

    it('should reject pending requests when terminated', async () => {
      if (!areWorkersAvailable()) {
        const manager = getWorkerManager();

        // Start a request that will fail
        const requestPromise = manager.submitProof('test', 'test', [], new Uint8Array());

        // Terminate while request is pending
        terminateWorker();

        // The pending request should be rejected
        await expect(requestPromise).rejects.toThrow();
      }
    });
  });
});

// A stand-in for the browser Worker: the test decides when it fails or signals ready, and a
// ready worker answers every proof request with `[1, 2, 3]`.
class FakeWorker {
  static instances: FakeWorker[] = [];
  onmessage: ((event: { data: unknown }) => void) | null = null;
  onerror: ((error: { message: string }) => void) | null = null;
  terminated = false;

  constructor() {
    FakeWorker.instances.push(this);
  }

  fail(message: string) {
    this.onerror?.({ message });
  }

  ready() {
    this.onmessage?.({ data: { id: 'init', type: 'ready' } });
  }

  postMessage(message: { id: string }) {
    queueMicrotask(() => this.onmessage?.({ data: { id: message.id, type: 'success', result: [1, 2, 3] } }));
  }

  terminate() {
    this.terminated = true;
  }
}

describe('WorkerManager initialization failures', () => {
  afterEach(() => {
    terminateWorker();
    vi.unstubAllGlobals();
    FakeWorker.instances = [];
  });

  it('starts a new worker on the next request after one fails to initialize', async () => {
    vi.stubGlobal('Worker', FakeWorker);
    const manager = getWorkerManager();

    const first = manager.submitProof('key', 'crs', [], new Uint8Array());
    FakeWorker.instances[0].fail('Failed to fetch dynamically imported module');
    await expect(first).rejects.toThrow('Worker failed to initialize');

    const second = manager.submitProof('key', 'crs', [], new Uint8Array());
    await vi.waitFor(() => expect(FakeWorker.instances).toHaveLength(2));
    FakeWorker.instances[1].ready();
    await expect(second).resolves.toEqual(new Uint8Array([1, 2, 3]));
    expect(FakeWorker.instances[0].terminated).toBe(true);
  });
});
