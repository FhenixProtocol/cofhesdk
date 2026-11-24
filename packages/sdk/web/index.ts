// Web specific functionality only

import {
  createCofheClientBase,
  createCofheConfigBase,
  type CofheClient,
  type CofheConfig,
  type CofheInputConfig,
  type ZkBuilderAndCrsGenerator,
  type FheKeyDeserializer,
  type TfheInitializer,
  type TfheThreadsSetting,
  type ProvingWorker,
  createKeysStore,
  fheTypeToString,
  TFHE_RS_SAFE_SERIALIZATION_SIZE_LIMIT,
} from '@/core';
import { fromHexString } from '../core/utils.js';

// Import web-specific storage (internal use only)
import { createIndexedDbStorage, createSsrStorage, createWebStorage } from './storage.js';

// Import worker manager
import { getWorkerManager, terminateWorker, areWorkersAvailable } from './workerManager.js';
import { WORKER_KEYS_DB_NAME } from './workerProtocol.js';
import type { WorkerStoredKeysReader } from '../core/encrypt/encryptInputsBuilder.js';

import { getTfheThreadPoolStatus, webClientParams } from './mainThreadTfhe.js';
import { hasDOM } from './const';

export { getTfheThreadPoolStatus };

/**
 * The proving worker, as the SDK core uses it. The worker runs its own TFHE and manages the keys
 * itself; this only forwards each step to it.
 *
 * Bound to the client's `tfheThreads` setting, which the worker applies when it first starts tfhe.
 */
function createProvingWorker(tfheThreads: TfheThreadsSetting): ProvingWorker {
  return {
    initTfhe: () => getWorkerManager().initTfhe(tfheThreads),
    fetchKeys: (target) => getWorkerManager().fetchKeys(target, tfheThreads),
    prove: (target, items, metadata) =>
      getWorkerManager().prove(
        target,
        // Bigints do not survive postMessage as such; the enum goes by its name.
        items.map((item) => ({
          utype: fheTypeToString(item.utype),
          data: typeof item.data === 'bigint' ? item.data.toString() : item.data,
        })),
        metadata,
        tfheThreads
      ),
  };
}

/**
 * Reads the keys the proving worker stored. For the main-thread fallback, so that it does not
 * download megabytes the browser already holds.
 */
const readWorkerStoredKeys: WorkerStoredKeysReader = async (chainId, securityZone) => {
  const store = createKeysStore(createIndexedDbStorage(WORKER_KEYS_DB_NAME));
  await store.rehydrateKeysStore();
  return { fheKey: store.getFheKey(chainId, securityZone), crs: store.getCrs(chainId, securityZone) };
};

/**
 * Creates a CoFHE configuration for web with IndexedDB storage as default
 * @param config - The CoFHE input configuration (fheKeyStorage will default to IndexedDB if not provided)
 * @returns The CoFHE configuration with web defaults applied
 */
export function createCofheConfig(config: CofheInputConfig): CofheConfig {
  return createCofheConfigBase({
    environment: 'web',
    ...config,
    fheKeyStorage:
      config.fheKeyStorage === null ? null : config.fheKeyStorage ?? (hasDOM ? createWebStorage() : createSsrStorage()),
  });
}

/**
 * Creates a CoFHE client instance for web with TFHE automatically configured
 * TFHE will be initialized automatically on first encryption - no manual setup required
 * Workers are automatically enabled if available (can be disabled via config.useWorkers)
 * @param config - The CoFHE configuration (use createCofheConfig to create with web defaults)
 * @returns The CoFHE client instance
 */
export function createCofheClient<TConfig extends CofheConfig>(config: TConfig): CofheClient<TConfig> {
  return createCofheClientBase({
    ...webClientParams(config),
    // Always provided when the Worker API exists (not in Node.js); `config.useWorkers` decides its use.
    provingWorker: areWorkersAvailable() ? createProvingWorker(config.tfheThreads) : undefined,
    readWorkerStoredKeys: areWorkersAvailable() ? readWorkerStoredKeys : undefined,
  });
}

/**
 * Terminate the worker (call on app cleanup)
 */
export { terminateWorker };

/**
 * Check if workers are available
 */
export { areWorkersAvailable };

// `createWebStorage` is the default `fheKeyStorage` of `createCofheConfig` (the shared hub, falling back
// to `createIndexedDbStorage`, the page's own IndexedDB). Exported so that an app can put its own observer
// around either (e.g. to report a storage it had to give up on) and pass the result.
export { createSsrStorage, createWebStorage, createIndexedDbStorage };
export type { OnStorageFallback, StorageOperation } from './storage.js';
export { hasDOM };
