import { describe, it, expect, afterEach } from 'vitest';
import { getWorkerManager, terminateWorker, areWorkersAvailable } from './workerManager.js';

describe('WorkerManager (Browser)', () => {
  afterEach(() => {
    // Clean up worker after each test
    terminateWorker();
  });

  describe('areWorkersAvailable', () => {
    it('should return true in browser environment', () => {
      // In real browser with Playwright, workers should be available
      expect(areWorkersAvailable()).toBe(true);
    });
  });

  describe('Worker lifecycle', () => {
    it('should initialize worker successfully', async () => {
      const manager = getWorkerManager();
      expect(manager).toBeDefined();

      // Worker should be available
      expect(areWorkersAvailable()).toBe(true);
    });

    it('should handle worker termination', () => {
      const manager = getWorkerManager();
      expect(manager).toBeDefined();

      terminateWorker();

      // Should be able to get a new instance
      const newManager = getWorkerManager();
      expect(newManager).toBeDefined();
    });
  });

  describe('submitProof', () => {
    it('should reject invalid data with error message', async () => {
      const manager = getWorkerManager();

      // Submit with invalid data - should fail quickly
      await expect(manager.submitProof('invalid', 'invalid', [], new Uint8Array())).rejects.toThrow();
    }, 35000);

    it('should reject invalid message type', async () => {
      const manager = getWorkerManager();

      // Submit with invalid data that will cause worker error
      await expect(
        manager.submitProof(
          '', // empty key
          '', // empty crs
          [{ utype: 'invalid', data: 'test' }],
          new Uint8Array([1, 2, 3])
        )
      ).rejects.toThrow();
    }, 35000);
  });

  describe('Concurrent requests', () => {
    it('should handle multiple concurrent proof requests', async () => {
      const manager = getWorkerManager();

      // Submit multiple requests concurrently
      const requests = [
        manager.submitProof('key1', 'crs1', [], new Uint8Array([1])),
        manager.submitProof('key2', 'crs2', [], new Uint8Array([2])),
        manager.submitProof('key3', 'crs3', [], new Uint8Array([3])),
      ];

      // All should reject (invalid data), but shouldn't crash
      const results = await Promise.allSettled(requests);

      expect(results).toHaveLength(3);
      results.forEach((result) => {
        expect(result.status).toBe('rejected');
      });
    }, 35000);
  });

  describe('Worker error handling', () => {
    it('should handle worker errors gracefully', async () => {
      const manager = getWorkerManager();

      // This should cause an error in the worker
      await expect(
        manager.submitProof(
          'malformed-hex',
          'malformed-crs',
          [{ utype: 'uint128', data: 'not-a-number' }],
          new Uint8Array([])
        )
      ).rejects.toThrow();
    }, 35000);
  });

  describe('Termination during processing', () => {
    it('should reject pending requests on termination', async () => {
      const manager = getWorkerManager();

      // Start a request (will timeout)
      const proofPromise = manager.submitProof('test', 'test', [], new Uint8Array());

      // Terminate immediately
      setTimeout(() => {
        terminateWorker();
      }, 100);

      // Request should be rejected
      await expect(proofPromise).rejects.toThrow();
    }, 5000);
  });
});
