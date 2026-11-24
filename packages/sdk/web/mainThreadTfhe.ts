/**
 * TFHE on the page's own thread: starting it, validating keys with it, and building a proof with
 * it. Only the main-thread proving path uses any of this; when the proving worker makes the proof,
 * nothing here runs.
 */
import {
  type ZkBuilderAndCrsGenerator,
  type FheKeyDeserializer,
  type TfheInitializer,
  type TfheThreadsSetting,
  TFHE_RS_SAFE_SERIALIZATION_SIZE_LIMIT,
} from '@/core';
import { fromHexString } from '../core/utils.js';
import type { MainThreadProving } from '../core/encrypt/provingPaths.js';

// Type-only import for tfhe — the runtime is loaded lazily via `await import('tfhe')`
// inside `initTfhe()` so that simply importing `@cofhe/sdk/web` (e.g. transitively
// through `@cofhe/react`) does not pull tfhe — and its worker helpers that
// reference `self` at module top — into the import graph during Next.js SSR.
import type { TfheCompactPublicKey, ProvenCompactCiphertextList, CompactPkeCrs } from 'tfhe';
import { hasDOM } from './const';
import { initTfheThreadPool, type TfheThreadPoolResult } from './tfheThreadPool.js';

let tfheModule: typeof import('tfhe') | null = null;
let tfheInitialized = false;
let tfheInitPromise: Promise<void> | null = null;
let threadPoolPromise: Promise<TfheThreadPoolResult> | null = null;
let threadPoolResult: TfheThreadPoolResult | null = null;

/**
 * Outcome of the rayon thread pool setup on the main thread, or `null` if the
 * main thread hasn't had to generate a proof yet. `enabled: false` carries a
 * `reason`.
 *
 * Note this reflects the *main thread* only. When workers are enabled (the
 * default) proving happens inside the zkProve worker, which runs its own pool,
 * and the main thread never starts one — so `null` is the normal value there.
 */
export function getTfheThreadPoolStatus(): TfheThreadPoolResult | null {
  return threadPoolResult;
}

/**
 * Internal TFHE initializer used on web.
 * Called automatically on first encryption - users don't need to call this manually.
 *
 * The wasm instance is a module-level singleton, so initialization is memoised.
 * It deliberately does NOT start the rayon thread pool: the main thread only
 * needs one when it generates a proof itself, see `createStartMainThreadPool`.
 *
 * @returns true if it performed the initialization, false if TFHE was already initialized
 */
const initTfhe: TfheInitializer = async () => {
  if (tfheInitialized) return false;

  if (tfheInitPromise) {
    // Another caller is already initializing; wait it out but don't claim
    // credit for having done it.
    await tfheInitPromise;
    return false;
  }

  tfheInitPromise = (async () => {
    const mod = await import('tfhe');
    await mod.default();
    await mod.init_panic_hook();
    tfheModule = mod;
    tfheInitialized = true;
  })();

  try {
    await tfheInitPromise;
  } catch (error) {
    // Let the next call retry from scratch.
    tfheInitPromise = null;
    throw error;
  }

  return true;
};

/**
 * Starts the main thread's rayon pool right before the main thread generates a
 * proof (workers disabled, unavailable, or the worker failed). With workers on
 * the proof runs in the zkProve worker, which has its own pool, so a second one
 * here would just be idle Web Workers plus another shared wasm memory.
 *
 * Must run before the FIRST main-thread proof: rayon locks in its global pool
 * on first use, and `initThreadPool` fails from then on. Deserializing keys and
 * packing inputs beforehand is fine. Memoised because `initThreadPool` may only
 * run once per wasm instance — if an app creates several clients with different
 * `tfheThreads` values, whichever proves on the main thread first wins.
 *
 * Best-effort: leaves tfhe single-threaded when the page isn't cross-origin
 * isolated rather than failing the encryption.
 */
function createStartMainThreadPool(tfheThreads: TfheThreadsSetting) {
  return async (): Promise<void> => {
    threadPoolPromise ??= initTfheThreadPool(requireTfhe(), tfheThreads);
    threadPoolResult = await threadPoolPromise;
  };
}

function requireTfhe(): typeof import('tfhe') {
  if (!tfheModule) {
    throw new Error('TFHE not initialized — call initTfhe() (or any client method that triggers it) first');
  }
  return tfheModule;
}

const _deserializeTfhePublicKey = (buff: string): TfheCompactPublicKey => {
  return requireTfhe().TfheCompactPublicKey.safe_deserialize(
    fromHexString(buff),
    TFHE_RS_SAFE_SERIALIZATION_SIZE_LIMIT
  );
};

const _deserializeCompactPkeCrs = (buff: string): CompactPkeCrs => {
  return requireTfhe().CompactPkeCrs.safe_deserialize(fromHexString(buff), TFHE_RS_SAFE_SERIALIZATION_SIZE_LIMIT);
};

/**
 * Serializer for TFHE public keys
 * Validates that the buffer can be deserialized into a TfheCompactPublicKey
 */
const tfhePublicKeyDeserializer: FheKeyDeserializer = (buff: string): void => {
  _deserializeTfhePublicKey(buff);
};

/**
 * Serializer for Compact PKE CRS
 * Validates that the buffer can be deserialized into ZkCompactPkePublicParams
 */
const compactPkeCrsDeserializer: FheKeyDeserializer = (buff: string): void => {
  _deserializeCompactPkeCrs(buff);
};

/**
 * Creates a ZK builder and CRS from FHE public key and CRS buffers
 * This is used internally by the SDK to create encrypted inputs
 */
const zkBuilderAndCrsGenerator: ZkBuilderAndCrsGenerator = (fhe: string, crs: string) => {
  const fhePublicKey = _deserializeTfhePublicKey(fhe);
  const zkBuilder = requireTfhe().ProvenCompactCiphertextList.builder(fhePublicKey);
  const zkCrs = _deserializeCompactPkeCrs(crs);

  return { zkBuilder, zkCrs };
};

/**
 * The main-thread proving path's parts for a web client. Shared by `createCofheClient` and by
 * `./testing.ts`, which builds a client around a substitute worker.
 */
export const mainThreadProving = (tfheThreads: TfheThreadsSetting): MainThreadProving => ({
  initTfhe,
  tfhePublicKeyDeserializer,
  compactPkeCrsDeserializer,
  zkBuilderAndCrsGenerator,
  beforeProve: createStartMainThreadPool(tfheThreads),
});
