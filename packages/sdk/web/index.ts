// Web specific functionality only

import {
  createCofhesdkClientBase,
  createCofhesdkConfigBase,
  type CofhesdkClient,
  type CofhesdkConfig,
  type CofhesdkInputConfig,
  type ZkBuilderAndCrsGenerator,
  type FheKeyDeserializer,
  type EncryptableItem,
  fheTypeToString,
} from '@/core';

// Import web-specific storage (internal use only)
import { createWebStorage } from './storage.js';

// Import worker manager
import { getWorkerManager, terminateWorker, areWorkersAvailable } from './workerManager.js';

// Import tfhe for web
import init, { init_panic_hook, TfheCompactPublicKey, ProvenCompactCiphertextList, CompactPkeCrs } from 'tfhe';

/**
 * Internal function to initialize TFHE for web
 * Called automatically on first encryption - users don't need to call this manually
 * @returns true if TFHE was initialized, false if already initialized
 */
let tfheInitialized = false;
async function initTfhe(): Promise<boolean> {
  if (tfheInitialized) return false;
  await init();
  await init_panic_hook();
  tfheInitialized = true;
  return true;
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

/**
 * Serializer for TFHE public keys
 * Validates that the buffer can be deserialized into a TfheCompactPublicKey
 */
const tfhePublicKeyDeserializer: FheKeyDeserializer = (buff: string): void => {
  TfheCompactPublicKey.deserialize(fromHexString(buff));
};

/**
 * Serializer for Compact PKE CRS
 * Validates that the buffer can be deserialized into ZkCompactPkePublicParams
 */
const compactPkeCrsDeserializer: FheKeyDeserializer = (buff: string): void => {
  CompactPkeCrs.deserialize(fromHexString(buff));
};

/**
 * Creates a ZK builder and CRS from FHE public key and CRS buffers
 * This is used internally by the SDK to create encrypted inputs
 */
const zkBuilderAndCrsGenerator: ZkBuilderAndCrsGenerator = (fhe: string, crs: string) => {
  const fhePublicKey = TfheCompactPublicKey.deserialize(fromHexString(fhe));
  const zkBuilder = ProvenCompactCiphertextList.builder(fhePublicKey);
  const zkCrs = CompactPkeCrs.deserialize(fromHexString(crs));

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
  const serializedItems = items.map(item => ({
    utype: fheTypeToString(item.utype),
    data: typeof item.data === 'bigint' ? item.data.toString() : item.data,
  }));
  
  // Submit to worker
  const workerManager = getWorkerManager();
  return await workerManager.submitProof(fheKeyHex, crsHex, serializedItems, metadata);
}

/**
 * Creates a CoFHE SDK configuration for web with IndexedDB storage as default
 * @param config - The CoFHE SDK input configuration (fheKeyStorage will default to IndexedDB if not provided)
 * @returns The CoFHE SDK configuration with web defaults applied
 */
export function createCofhesdkConfig(config: CofhesdkInputConfig): CofhesdkConfig {
  return createCofhesdkConfigBase({
    ...config,
    fheKeyStorage: config.fheKeyStorage === null ? null : config.fheKeyStorage ?? createWebStorage(),
  });
}

/**
 * Creates a CoFHE SDK client instance for web with TFHE automatically configured
 * TFHE will be initialized automatically on first encryption - no manual setup required
 * Workers are automatically enabled if available (can be disabled via config.useWorkers)
 * @param config - The CoFHE SDK configuration (use createCofhesdkConfig to create with web defaults)
 * @returns The CoFHE SDK client instance
 */
export function createCofhesdkClient(config: CofhesdkConfig): CofhesdkClient {
  return createCofhesdkClientBase({
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
export function createCofhesdkClientWithCustomWorker(
  config: CofhesdkConfig,
  customZkProveWorkerFn: (fheKeyHex: string, crsHex: string, items: EncryptableItem[], metadata: Uint8Array) => Promise<Uint8Array>
): CofhesdkClient {
  return createCofhesdkClientBase({
    config,
    zkBuilderAndCrsGenerator,
    tfhePublicKeyDeserializer,
    compactPkeCrsDeserializer,
    initTfhe,
    zkProveWorkerFn: customZkProveWorkerFn,
  });
}
