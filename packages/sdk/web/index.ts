// Web specific functionality only

import {
  createCofheClientBase,
  createCofheConfigBase,
  type CofheClient,
  type CofheConfig,
  type CofheInputConfig,
  type ZkBuilderAndCrsGenerator,
  type FheKeyDeserializer,
  type EncryptableItem,
  fheTypeToString,
  TFHE_RS_SAFE_SERIALIZATION_SIZE_LIMIT,
} from '@/core';

// Import web-specific storage (internal use only)
import { createSsrStorage, createWebStorage } from './storage.js';

// Import worker manager
import { getWorkerManager, terminateWorker, areWorkersAvailable } from './workerManager.js';

// Type-only import for tfhe — the runtime is loaded lazily via `await import('tfhe')`
// inside `initTfhe()` so that simply importing `@cofhe/sdk/web` (e.g. transitively
// through `@cofhe/react`) does not pull tfhe — and its worker helpers that
// reference `self` at module top — into the import graph during Next.js SSR.
import type { TfheCompactPublicKey, ProvenCompactCiphertextList, CompactPkeCrs } from 'tfhe';
import { hasDOM } from './const';

/**
 * Internal function to initialize TFHE for web
 * Called automatically on first encryption - users don't need to call this manually
 * @returns true if TFHE was initialized, false if already initialized
 */
let tfheModule: typeof import('tfhe') | null = null;
let tfheInitialized = false;
async function initTfhe(): Promise<boolean> {
  if (tfheInitialized) return false;
  tfheModule = await import('tfhe');
  await tfheModule.default();
  await tfheModule.init_panic_hook();
  tfheInitialized = true;
  return true;
}

function requireTfhe(): typeof import('tfhe') {
  if (!tfheModule) {
    throw new Error('TFHE not initialized — call initTfhe() (or any client method that triggers it) first');
  }
  return tfheModule;
}

/**
 * Utility to convert the hex string key to a Uint8Array for use with tfhe
 */
const fromHexString = (hexString: string): Uint8Array => {
  const cleanString = hexString.length % 2 === 1 ? `0${hexString}` : hexString;
  const arr = cleanString.replace(/^0x/, '').match(/.{1,2}/g);
  if (!arr) return new Uint8Array();
  return new Uint8Array(arr.map((byte) => parseInt(byte, 16)));
};

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
 * Worker-enabled zkProve function
 * This submits proof generation to a Web Worker
 */
async function zkProveWithWorker(
  fheKeyHex: string,
  crsHex: string,
  items: EncryptableItem[],
  metadata: Uint8Array
): Promise<Uint8Array> {
  // Serialize items for worker (convert enum to string name)
  const serializedItems = items.map((item) => ({
    utype: fheTypeToString(item.utype),
    data: typeof item.data === 'bigint' ? item.data.toString() : item.data,
  }));

  // Submit to worker
  const workerManager = getWorkerManager();
  return await workerManager.submitProof(fheKeyHex, crsHex, serializedItems, metadata);
}

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
    config,
    zkBuilderAndCrsGenerator,
    tfhePublicKeyDeserializer,
    compactPkeCrsDeserializer,
    initTfhe,
    // Always provide the worker function if available - config.useWorkers controls usage
    // areWorkersAvailable will return true if the Worker API is available and false in Node.js
    zkProveWorkerFn: areWorkersAvailable() ? zkProveWithWorker : undefined,
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

/**
 * Test helper: Create a client with custom worker function (for testing fallback behavior)
 * @internal - Only for testing purposes
 */
export function createCofheClientWithCustomWorker(
  config: CofheConfig,
  customZkProveWorkerFn: (
    fheKeyHex: string,
    crsHex: string,
    items: EncryptableItem[],
    metadata: Uint8Array
  ) => Promise<Uint8Array>
): CofheClient {
  return createCofheClientBase({
    config,
    zkBuilderAndCrsGenerator,
    tfhePublicKeyDeserializer,
    compactPkeCrsDeserializer,
    initTfhe,
    zkProveWorkerFn: customZkProveWorkerFn,
  });
}

export { createSsrStorage };
export { hasDOM } from './const';
