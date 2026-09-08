import { describe, it, expect } from 'vitest';
import { benchProve, reportBench } from './threadPoolBenchHelper.js';

// Baseline: same workload, no rayon pool. Kept in its own file because each
// vitest browser file gets a fresh tfhe wasm instance, and `initThreadPool`
// can only run once per instance — so single- vs multi-threaded can't be
// compared inside one file.
describe('tfhe proving — single-threaded baseline', () => {
  it('proves without a rayon thread pool', async () => {
    const result = await benchProve(1);
    reportBench('single-threaded', result);

    expect(result.threadPool.enabled).toBe(false);
    expect(result.rayonWorkers).toBe(0);
    expect(result.medianMs).toBeGreaterThan(0);
  }, 300000);
});
