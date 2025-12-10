import { describe, it, expect, afterEach } from 'vitest';
import { getWorkerManager, terminateWorker, areWorkersAvailable } from './workerManager.js';

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
