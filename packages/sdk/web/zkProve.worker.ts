/**
 * Web Worker for ZK proof generation.
 *
 * It is self-sufficient: it runs its own TFHE, and it fetches, validates, stores and keeps the
 * FHE key and the CRS itself, so the page never has to start TFHE or touch the keys.
 */

/// <reference lib="webworker" />
/* eslint-disable no-undef */

import { TFHE_RS_SAFE_SERIALIZATION_SIZE_LIMIT } from '../core/consts';
import type { KeysTarget } from '../core/encrypt/zkPackProveVerify.js';
import { fetchKeysFromUrl } from '../core/fetchKeys.js';
import { createKeysStore } from '../core/keyStore.js';
import { createIndexedDbStorage } from './indexedDbStorage.js';
import { WORKER_KEYS_DB_NAME, type WorkerItem, type WorkerRequest, type WorkerResponse } from './workerProtocol.js';
import { initTfheThreadPool, type TfheThreadPoolResult } from './tfheThreadPool.js';
import type { TfheThreadsSetting } from '../core/types.js';
import { fromHexString } from '../core/utils.js';

// TFHE module (will be initialized on first use)
let tfheModule: any = null;
let initPromise: Promise<void> | null = null;
let threadPool: TfheThreadPoolResult | null = null;

/**
 * Initialize TFHE in worker context
 *
 * This is where the heavy `build_with_proof_packed` call runs, so it's also
 * where tfhe's rayon thread pool matters most — the main-thread pool only helps
 * the non-worker fallback path. The pool spawns nested Workers that share this
 * worker's wasm memory, which requires the page to be cross-origin isolated;
 * `initTfheThreadPool` degrades to single-threaded instead of throwing when it
 * isn't.
 *
 * Memoised on the in-flight promise rather than on completion: further proof
 * requests can arrive while the first one is still initializing, and
 * `initThreadPool` may only run once per wasm instance — a second call spawns
 * its workers, fails to build the pool, and leaves those workers stranded.
 */
function initTfhe(tfheThreads: TfheThreadsSetting = 'auto'): Promise<void> {
  initPromise ??= (async () => {
    try {
      // Dynamic import of tfhe module
      tfheModule = await import('tfhe');
      await tfheModule.default();
      await tfheModule.init_panic_hook();

      threadPool = await initTfheThreadPool(tfheModule, tfheThreads);

      console.log(
        threadPool.enabled
          ? `[Worker] TFHE initialized (rayon thread pool: ${threadPool.threads} threads)`
          : `[Worker] TFHE initialized (single-threaded: ${threadPool.reason})`
      );
    } catch (error) {
      console.error('[Worker] Failed to initialize TFHE:', error);
      // Let the next request retry from scratch.
      initPromise = null;
      throw error;
    }
  })();

  return initPromise;
}

/**
 * Starts TFHE if it is not running yet.
 * @returns true when this call started it, false when it was already started or starting.
 */
async function ensureTfhe(tfheThreads?: TfheThreadsSetting): Promise<boolean> {
  const startedHere = initPromise == null;
  await initTfhe(tfheThreads);
  if (!tfheModule) throw new Error('TFHE module not initialized');
  return startedHere;
}

// ===== KEYS =====

/** The keys for one chain and security zone, deserialized and ready to prove with. */
type ReadyKeys = { fheKey: any; crs: any };

// The worker's own persistent key store: the same store the page uses, on the worker's own
// IndexedDB database. A storage that cannot be read or written degrades to memory inside it.
const keysStore = createKeysStore(createIndexedDbStorage(WORKER_KEYS_DB_NAME));

// Deserialized keys are megabytes and slow to rebuild, so they are kept for the worker's life.
// The promise is cached, not the result: requests for the same keys that overlap share one load.
const readyKeys = new Map<string, Promise<ReadyKeys>>();

const deserializeFheKey = (hex: string) =>
  tfheModule.TfheCompactPublicKey.safe_deserialize(fromHexString(hex), TFHE_RS_SAFE_SERIALIZATION_SIZE_LIMIT);
const deserializeCrs = (hex: string) =>
  tfheModule.CompactPkeCrs.safe_deserialize(fromHexString(hex), TFHE_RS_SAFE_SERIALIZATION_SIZE_LIMIT);

/**
 * Loads the keys for `target`: from the worker's store when it holds valid ones, from the CoFHE
 * server otherwise (then stored). Deserializing is how a key is validated, so the object that
 * validation produced is kept and the megabytes are deserialized once, not twice.
 */
async function loadKeys(target: KeysTarget): Promise<ReadyKeys & { fheKeyFetched: boolean; crsFetched: boolean }> {
  await keysStore.rehydrateKeysStore();

  let validatedFheKey: { hex: string; key: any } | undefined;
  let validatedCrs: { hex: string; key: any } | undefined;

  const [[fheKeyHex, fheKeyFetched], [crsHex, crsFetched]] = await fetchKeysFromUrl(
    target.coFheUrl,
    target.chainId,
    target.securityZone,
    (hex) => {
      validatedFheKey = { hex, key: deserializeFheKey(hex) };
    },
    (hex) => {
      validatedCrs = { hex, key: deserializeCrs(hex) };
    },
    keysStore
  );

  return {
    fheKey: validatedFheKey?.hex === fheKeyHex ? validatedFheKey.key : deserializeFheKey(fheKeyHex),
    crs: validatedCrs?.hex === crsHex ? validatedCrs.key : deserializeCrs(crsHex),
    fheKeyFetched,
    crsFetched,
  };
}

/**
 * Makes sure the keys for `target` are loaded.
 * @returns the keys, and whether this call had to download each of them.
 */
async function ensureKeys(
  target: KeysTarget
): Promise<ReadyKeys & { fheKeyFetchedFromCoFHE: boolean; crsFetchedFromCoFHE: boolean }> {
  const slot = `${target.chainId}:${target.securityZone}`;

  const alreadyLoading = readyKeys.get(slot);
  if (alreadyLoading) {
    return { ...(await alreadyLoading), fheKeyFetchedFromCoFHE: false, crsFetchedFromCoFHE: false };
  }

  const loading = loadKeys(target);
  readyKeys.set(slot, loading);
  // A failed load is not kept: the next request tries again.
  loading.catch(() => {
    if (readyKeys.get(slot) === loading) readyKeys.delete(slot);
  });

  const { fheKey, crs, fheKeyFetched, crsFetched } = await loading;
  return { fheKey, crs, fheKeyFetchedFromCoFHE: fheKeyFetched, crsFetchedFromCoFHE: crsFetched };
}

// ===== PROVING =====

/** Packs the items. The page has already made the range and size checks (`assertZkPackable`). */
function pack(builder: any, items: WorkerItem[]): void {
  for (const item of items) {
    switch (item.utype) {
      case 'bool':
        builder.push_boolean(Boolean(item.data));
        break;
      case 'uint8':
        builder.push_u8(Number(item.data));
        break;
      case 'uint16':
        builder.push_u16(Number(item.data));
        break;
      case 'uint32':
        builder.push_u32(Number(item.data));
        break;
      case 'uint64':
        builder.push_u64(BigInt(item.data));
        break;
      case 'uint128':
        builder.push_u128(BigInt(item.data));
        break;
      case 'uint160':
        builder.push_u160(BigInt(item.data));
        break;
      default:
        throw new Error(`Unsupported type: ${item.utype}`);
    }
  }
}

async function handle(request: WorkerRequest): Promise<WorkerResponse & { type: 'success' }> {
  const { id } = request;

  switch (request.type) {
    case 'initTfhe':
      return { id, type: 'success', result: { tfheInitializationExecuted: await ensureTfhe(request.tfheThreads) } };

    case 'fetchKeys': {
      await ensureTfhe(request.tfheThreads);
      const { fheKeyFetchedFromCoFHE, crsFetchedFromCoFHE } = await ensureKeys(request.target);
      return { id, type: 'success', result: { fheKeyFetchedFromCoFHE, crsFetchedFromCoFHE } };
    }

    case 'zkProve': {
      // Neither earlier step is assumed: a worker that was restarted since gets ready here.
      await ensureTfhe(request.tfheThreads);
      const { fheKey, crs } = await ensureKeys(request.target);

      const builder = tfheModule.ProvenCompactCiphertextList.builder(fheKey);
      pack(builder, request.items);

      // The heavy operation, off the page's thread.
      const compactList = builder.build_with_proof_packed(crs, new Uint8Array(request.metadata), 1);
      return { id, type: 'success', result: compactList.safe_serialize(TFHE_RS_SAFE_SERIALIZATION_SIZE_LIMIT) };
    }

    default:
      throw new Error('Invalid message type');
  }
}

// Guard the top-level `self` references so this file is safe to evaluate in
// non-worker contexts (e.g. when bundlers like webpack pull the worker chunk
// into the server bundle for SSR). The body is dead code anywhere `self` is
// undefined, so skipping it is harmless.
if (typeof self !== 'undefined') {
  self.onmessage = async (event: MessageEvent) => {
    const request = event.data as WorkerRequest;
    try {
      self.postMessage(await handle(request));
    } catch (error) {
      self.postMessage({
        id: request?.id,
        type: 'error',
        error: error instanceof Error ? error.message : String(error),
      } satisfies WorkerResponse);
    }
  };

  self.postMessage({ id: 'init', type: 'ready' } satisfies WorkerResponse);
}
