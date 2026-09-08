import { describe, it, expect } from 'vitest';
import { MAX_AUTO_THREADS, initTfheThreadPool, resolveThreadCount } from '../tfheThreadPool.js';
import { benchProve, reportBench } from './threadPoolBenchHelper.js';

describe('resolveThreadCount', () => {
  it("derives from hardwareConcurrency for 'auto', capped", () => {
    const expected = Math.min(navigator.hardwareConcurrency, MAX_AUTO_THREADS);

    expect(resolveThreadCount('auto')).toBe(expected);
    expect(resolveThreadCount()).toBe(expected); // 'auto' is the default
  });

  it('honours an explicit count, even above the auto cap', () => {
    expect(resolveThreadCount(1)).toBe(1);
    expect(resolveThreadCount(3)).toBe(3);
    // An explicit request is trusted over hardwareConcurrency and the cap.
    expect(resolveThreadCount(MAX_AUTO_THREADS + 4)).toBe(MAX_AUTO_THREADS + 4);
  });

  it('collapses false and nonsense values to single-threaded', () => {
    expect(resolveThreadCount(false)).toBe(1);
    expect(resolveThreadCount(0)).toBe(1);
    expect(resolveThreadCount(-8)).toBe(1);
    expect(resolveThreadCount(Number.NaN)).toBe(1);
  });
});

describe('initTfheThreadPool', () => {
  it('reports disabled without touching tfhe when config says false', async () => {
    let called = false;
    const result = await initTfheThreadPool(
      {
        initThreadPool: async () => {
          called = true;
        },
      },
      false
    );

    expect(result.enabled).toBe(false);
    expect(result.threads).toBe(1);
    expect(result.reason).toContain('config.tfheThreads');
    expect(called).toBe(false);
  });

  it('degrades instead of throwing when initThreadPool fails', async () => {
    const result = await initTfheThreadPool(
      {
        initThreadPool: async () => {
          throw new Error('nested worker blocked');
        },
      },
      4
    );

    expect(result.enabled).toBe(false);
    expect(result.threads).toBe(1);
    expect(result.reason).toContain('nested worker blocked');
  });
});

describe('tfhe proving — rayon thread pool', () => {
  it('starts the pool and spawns real worker threads', async () => {
    const expectedThreads = resolveThreadCount('auto');
    const result = await benchProve(expectedThreads);
    reportBench('multi-threaded', result);

    // The page must be cross-origin isolated for this to work at all.
    expect((globalThis as any).crossOriginIsolated).toBe(true);

    expect(result.threadPool.enabled).toBe(true);
    expect(result.threadPool.threads).toBe(expectedThreads);

    // Direct evidence the threads are real: initThreadPool constructed one
    // Worker per rayon thread.
    expect(result.rayonWorkers).toBe(expectedThreads);

    expect(result.medianMs).toBeGreaterThan(0);
  }, 300000);
});
