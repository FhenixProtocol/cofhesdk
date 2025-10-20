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
  FheTypes,
  setZkProveWorkerFunction,
  constructZkPoKMetadata,
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
 * Convert FheTypes enum to string name for worker communication
 */
function fheTypeToString(utype: FheTypes): string {
  switch (utype) {
    case FheTypes.Bool:
      return 'bool';
    case FheTypes.Uint4:
      return 'uint4';
    case FheTypes.Uint8:
      return 'uint8';
    case FheTypes.Uint16:
      return 'uint16';
    case FheTypes.Uint32:
      return 'uint32';
    case FheTypes.Uint64:
      return 'uint64';
    case FheTypes.Uint128:
      return 'uint128';
    case FheTypes.Uint160:
      return 'uint160';
    case FheTypes.Uint256:
      return 'uint256';
    case FheTypes.Uint512:
      return 'uint512';
    case FheTypes.Uint1024:
      return 'uint1024';
    case FheTypes.Uint2048:
      return 'uint2048';
    case FheTypes.Uint2:
      return 'uint2';
    case FheTypes.Uint6:
      return 'uint6';
    case FheTypes.Uint10:
      return 'uint10';
    default:
      throw new Error(`Unknown FheType: ${utype}`);
  }
}

/**
 * Worker-enabled zkProve function
 * This submits proof generation to a Web Worker
 */
async function zkProveWithWorker(
  fheKeyHex: string,
  crsHex: string,
  items: EncryptableItem[],
  address: string,
  securityZone: number,
  chainId: number
): Promise<Uint8Array> {
  const metadata = constructZkPoKMetadata(address, securityZone, chainId);
  
  // Serialize items for worker (convert enum to string name)
  const serializedItems = items.map(item => ({
    utype: fheTypeToString(item.utype),
    data: typeof item.data === 'bigint' ? item.data.toString() : item.data,
  }));
  
  // Submit to worker
  const workerManager = getWorkerManager();
  return await workerManager.submitProof(fheKeyHex, crsHex, serializedItems, metadata);
}

// Initialize worker function if workers are available
if (areWorkersAvailable()) {
  setZkProveWorkerFunction(zkProveWithWorker);
  console.log('[CoFHE SDK Web] Worker-based proof generation enabled');
} else {
  console.warn('[CoFHE SDK Web] Workers not available, using main thread for proofs');
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
 * Workers are automatically used for ZK proof generation if available
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
