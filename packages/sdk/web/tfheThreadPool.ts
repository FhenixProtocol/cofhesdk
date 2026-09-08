/**
 * Rayon thread pool setup for the browser build of tfhe.
 *
 * `tfhe` is built with wasm-bindgen-rayon, so the ZK proof (the
 * `build_with_proof_packed` call, by far the most expensive step of
 * `encryptInputs`) can run across several threads. Those threads are real Web
 * Workers that share the wasm linear memory, and `initThreadPool` hands them
 * that memory over `postMessage`.
 *
 * Sharing memory across threads is only allowed in a cross-origin-isolated
 * context, so the host page must be served with:
 *
 *   Cross-Origin-Opener-Policy:   same-origin
 *   Cross-Origin-Embedder-Policy: require-corp   (or `credentialless`)
 *
 * Plenty of apps can't or don't set those headers, and calling
 * `initThreadPool` without them throws ("SharedArrayBuffer transfer requires
 * self.crossOriginIsolated"). So this is strictly an optimisation: we probe for
 * isolation, and when it isn't available we leave tfhe single-threaded rather
 * than failing the encryption. Single-threaded tfhe works in every context.
 */

import type { TfheThreadsSetting } from '@/core';

/**
 * Cap for the auto-derived thread count.
 *
 * Proving keeps getting faster all the way up to core count, but with sharply
 * diminishing returns — measured on a 12-core machine (median of 5 proofs of
 * uint128 + uint64 + uint32):
 *
 *   threads |  1   |  2   |  4   |  6   |  8   |  12
 *   median  | 3199 | 1687 |  964 |  728 |  657 |  624   (ms)
 *   speedup | 1.0x | 1.9x | 3.3x | 4.4x | 4.9x | 5.1x
 *
 * Past 8 threads the curve is flat (8 -> 12 is ~5% for 50% more workers), and
 * every rayon thread is a real Web Worker competing with the host app's main
 * thread. 8 captures ~95% of the achievable speedup, so we stop there.
 */
export const MAX_AUTO_THREADS = 8;

/**
 * Resolve a `config.tfheThreads` setting into a concrete thread count.
 * Returns 1 to mean "don't start a pool".
 *
 * For `'auto'`, Zama's guidance is `initThreadPool(navigator.hardwareConcurrency)`;
 * we follow that but clamp to {@link MAX_AUTO_THREADS}. `hardwareConcurrency`
 * counts logical cores and some browsers deliberately misreport it (Firefox with
 * `privacy.resistFingerprinting` returns 2, Safari clamps it), and it can be
 * absent outside a browser — hence the `?? 1` fallback and the floor of 1.
 */
export function resolveThreadCount(setting: TfheThreadsSetting = 'auto'): number {
  // Explicit opt-out.
  if (setting === false) return 1;

  // Explicit count: trust the caller over `hardwareConcurrency` (which browsers
  // clamp for privacy) but keep it a sane integer.
  if (typeof setting === 'number') {
    return Number.isFinite(setting) && setting >= 1 ? Math.floor(setting) : 1;
  }

  const cores = (globalThis as { navigator?: { hardwareConcurrency?: number } }).navigator?.hardwareConcurrency ?? 1;

  if (!Number.isFinite(cores) || cores < 1) return 1;

  return Math.min(Math.floor(cores), MAX_AUTO_THREADS);
}

export type TfheThreadPoolResult = {
  /** Whether a multi-threaded rayon pool is now running */
  enabled: boolean;
  /** Threads requested from `initThreadPool` (1 when single-threaded) */
  threads: number;
  /** Why the pool was not started, when `enabled` is false */
  reason?: string;
};

/** Minimal shape of the parts of the tfhe module this file touches. */
type TfheThreadPoolModule = {
  initThreadPool?: (numThreads: number) => Promise<unknown>;
};

/** True when the current context may share wasm memory between threads. */
export function isCrossOriginIsolated(): boolean {
  return (globalThis as { crossOriginIsolated?: boolean }).crossOriginIsolated === true;
}

/**
 * Start tfhe's rayon thread pool, if the environment allows it.
 *
 * Safe to call when unsupported — it reports why it bailed instead of throwing,
 * leaving tfhe single-threaded. `initThreadPool` must only run once per wasm
 * instance, so callers are responsible for calling this once (both call sites
 * in this package memoise their whole tfhe init).
 */
export async function initTfheThreadPool(
  mod: TfheThreadPoolModule,
  setting: TfheThreadsSetting = 'auto'
): Promise<TfheThreadPoolResult> {
  if (setting === false) {
    return { enabled: false, threads: 1, reason: 'disabled via config.tfheThreads' };
  }

  if (typeof mod.initThreadPool !== 'function') {
    return { enabled: false, threads: 1, reason: 'tfhe build has no initThreadPool (single-threaded wasm)' };
  }

  if (typeof Worker === 'undefined') {
    return { enabled: false, threads: 1, reason: 'Worker is unavailable' };
  }

  // The real gate. Without isolation `initThreadPool` throws on postMessage.
  if (!isCrossOriginIsolated()) {
    return {
      enabled: false,
      threads: 1,
      reason:
        'not cross-origin isolated — serve the page with Cross-Origin-Opener-Policy: same-origin and ' +
        'Cross-Origin-Embedder-Policy: require-corp (or credentialless) to enable multi-threaded proving',
    };
  }

  const threads = resolveThreadCount(setting);
  if (threads <= 1) {
    return { enabled: false, threads: 1, reason: 'resolved to a single thread' };
  }

  try {
    await mod.initThreadPool(threads);
    return { enabled: true, threads };
  } catch (error) {
    // Nested-worker spawning and shared-memory transfer are the flaky parts
    // across browsers; a failure here must not take the encryption down.
    return {
      enabled: false,
      threads: 1,
      reason: `initThreadPool failed: ${error instanceof Error ? error.message : String(error)}`,
    };
  }
}
