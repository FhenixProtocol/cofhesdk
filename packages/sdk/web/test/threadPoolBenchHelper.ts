/**
 * Shared harness for the initThreadPool verification tests.
 *
 * Each vitest browser test file runs in its own iframe, so each gets a fresh
 * tfhe wasm instance — which is what lets us compare single-threaded vs
 * multi-threaded proving (`initThreadPool` may only run once per instance).
 */

import { TFHE_RS_SAFE_SERIALIZATION_SIZE_LIMIT } from '../../core/consts';
import { STAGING_TESTS } from '../../core/test/stagingRedirect';
import { arbSepolia as cofheArbSepolia, stagingCofhe } from '@/chains';
import { initTfheThreadPool, type TfheThreadPoolResult } from '../tfheThreadPool.js';

// Same backend as the rest of the web suite: Arbitrum Sepolia, or staging when
// TEST_STAGING_ENABLED=true.
const COFHE_URL = (STAGING_TESTS ? stagingCofhe : cofheArbSepolia).coFheUrl;

// Injected by vitest.config.mts from TEST_THREADPOOL_ENABLED.
declare const __THREADPOOL_TESTS__: boolean | undefined;

/**
 * Gate for the suites that generate real proofs on a rayon pool. They are
 * CPU-heavy: inside the regular, fully parallel test run they starve other
 * proving tests into timeouts on small CI runners, and skew their own timings.
 * So they are skipped by default and run on their own, one file at a time:
 *
 *   TEST_THREADPOOL_ENABLED=true pnpm test:threadpool
 *
 * which is what the "Test (thread pool)" CI job does.
 */
export const THREADPOOL_TESTS = typeof __THREADPOOL_TESTS__ !== 'undefined' ? __THREADPOOL_TESTS__ : false;

function fromHexString(hexString: string): Uint8Array {
  const cleanString = hexString.length % 2 === 1 ? `0${hexString}` : hexString;
  const arr = cleanString.replace(/^0x/, '').match(/.{1,2}/g);
  if (!arr) return new Uint8Array();
  return new Uint8Array(arr.map((byte) => parseInt(byte, 16)));
}

/** Fetch the network's real FHE public key + CRS. Proving itself is fully local. */
export async function fetchNetworkKeys(securityZone = 0): Promise<{ fheKey: string; crs: string }> {
  const post = async (path: string) => {
    const res = await fetch(`${COFHE_URL}/${path}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ securityZone }),
    });
    if (!res.ok) throw new Error(`${path} failed: ${res.status} ${res.statusText}`);
    return res.json();
  };

  const [pk, crs] = await Promise.all([post('GetNetworkPublicKey'), post('GetCrs')]);
  return { fheKey: (pk as { publicKey: string }).publicKey, crs: (crs as { crs: string }).crs };
}

export type BenchResult = {
  threadPool: TfheThreadPoolResult;
  /** Workers constructed during initThreadPool (the rayon threads) */
  rayonWorkers: number;
  /** Per-iteration proving durations in ms */
  durations: number[];
  medianMs: number;
};

/**
 * Init tfhe (optionally with the rayon pool) and time `build_with_proof_packed`.
 *
 * @param threads rayon threads to request; <= 1 skips the pool entirely
 * @param iterations how many proofs to time
 */
export async function benchProve(threads: number, iterations = 5): Promise<BenchResult> {
  const mod: any = await import('tfhe');
  await mod.default();
  await mod.init_panic_hook();

  // Count the Workers initThreadPool spawns — direct evidence the rayon threads
  // are real, separate from any timing signal.
  const RealWorker = globalThis.Worker;
  let rayonWorkers = 0;
  (globalThis as any).Worker = class extends RealWorker {
    constructor(url: string | URL, opts?: WorkerOptions) {
      super(url as any, opts);
      rayonWorkers++;
    }
  };

  let threadPool: TfheThreadPoolResult;
  try {
    threadPool =
      threads > 1
        ? await initTfheThreadPool(mod, threads)
        : { enabled: false, threads: 1, reason: 'skipped by benchmark' };
  } finally {
    (globalThis as any).Worker = RealWorker;
  }

  const { fheKey, crs } = await fetchNetworkKeys();
  const pk = mod.TfheCompactPublicKey.safe_deserialize(fromHexString(fheKey), TFHE_RS_SAFE_SERIALIZATION_SIZE_LIMIT);
  const zkCrs = mod.CompactPkeCrs.safe_deserialize(fromHexString(crs), TFHE_RS_SAFE_SERIALIZATION_SIZE_LIMIT);

  // Dummy metadata: we only measure local proof generation, never verify it.
  const metadata = new Uint8Array(32).fill(7);

  const durations: number[] = [];
  for (let i = 0; i < iterations; i++) {
    const builder = mod.ProvenCompactCiphertextList.builder(pk);
    builder.push_u128(BigInt(1000 + i));
    builder.push_u64(BigInt(2000 + i));
    builder.push_u32(3000 + i);

    const started = performance.now();
    builder.build_with_proof_packed(zkCrs, metadata, 1);
    durations.push(performance.now() - started);
  }

  const sorted = [...durations].sort((a, b) => a - b);
  const medianMs = sorted[Math.floor(sorted.length / 2)];

  return { threadPool, rayonWorkers, durations, medianMs };
}

export function reportBench(label: string, result: BenchResult): void {
  console.log(
    `[THREADPOOL BENCH] ${label} ` +
      JSON.stringify(
        {
          crossOriginIsolated: (globalThis as any).crossOriginIsolated,
          hardwareConcurrency: navigator.hardwareConcurrency,
          poolEnabled: result.threadPool.enabled,
          poolThreads: result.threadPool.threads,
          poolReason: result.threadPool.reason,
          rayonWorkers: result.rayonWorkers,
          medianMs: Math.round(result.medianMs),
          durations: result.durations.map((d) => Math.round(d)),
        },
        null,
        2
      )
  );
}
