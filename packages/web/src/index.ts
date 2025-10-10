// Re-export everything from core except createCofhesdkClient
export * from '@cofhesdk/core';

// Export web-specific storage
export { createWebStorage } from './storage.js';
import { createWebStorage } from './storage.js';

// Import tfhe for web
import init, { init_panic_hook, TfheCompactPublicKey, ProvenCompactCiphertextList, CompactPkeCrs } from 'tfhe';

import {
  createCofhesdkClient as createCofhesdkClientCore,
  createCofhesdkConfig as createCofhesdkConfigCore,
  type CofhesdkClient,
  type CofhesdkConfig,
  type CofhesdkInputConfig,
  type ZkBuilderAndCrsGenerator,
  type FheKeySerializer,
} from '@cofhesdk/core';

/**
 * Internal function to initialize TFHE for web
 * Called automatically on first encryption - users don't need to call this manually
 * @internal
 */
let tfheInitialized = false;
async function initTfhe(): Promise<void> {
  if (tfheInitialized) return;
  await init();
  await init_panic_hook();
  tfheInitialized = true;
}

/**
 * Serializer for TFHE public keys
 * Validates that the buffer can be deserialized into a TfheCompactPublicKey
 */
export const tfhePublicKeySerializer: FheKeySerializer = (buff: Uint8Array): void => {
  TfheCompactPublicKey.deserialize(buff);
};

/**
 * Serializer for Compact PKE CRS
 * Validates that the buffer can be deserialized into ZkCompactPkePublicParams
 */
export const compactPkeCrsSerializer: FheKeySerializer = (buff: Uint8Array): void => {
  CompactPkeCrs.deserialize(buff);
};

/**
 * Creates a ZK builder and CRS from FHE public key and CRS buffers
 * This is used internally by the SDK to create encrypted inputs
 */
export const zkBuilderAndCrsGenerator: ZkBuilderAndCrsGenerator = (fhe: Uint8Array, crs: Uint8Array) => {
  const fhePublicKey = TfheCompactPublicKey.deserialize(fhe);
  const zkBuilder = ProvenCompactCiphertextList.builder(fhePublicKey);
  const zkCrs = CompactPkeCrs.deserialize(crs);

  return { zkBuilder, zkCrs };
};

/**
 * Creates a CoFHE SDK configuration for web with IndexedDB storage as default
 * @param config - The CoFHE SDK input configuration (fheKeyStorage will default to IndexedDB if not provided)
 * @returns The CoFHE SDK configuration with web defaults applied
 */
export function createCofhesdkConfig(config: CofhesdkInputConfig): CofhesdkConfig {
  return createCofhesdkConfigCore({
    ...config,
    fheKeyStorage: config.fheKeyStorage === null ? null : config.fheKeyStorage ?? createWebStorage(),
  });
}

/**
 * Creates a CoFHE SDK client instance for web with TFHE automatically configured
 * TFHE will be initialized automatically on first encryption - no manual setup required
 * @param config - The CoFHE SDK configuration (use createCofhesdkConfig to create with web defaults)
 * @returns The CoFHE SDK client instance
 */
export function createCofhesdkClient(config: CofhesdkConfig): CofhesdkClient {
  return createCofhesdkClientCore({
    config,
    zkBuilderAndCrsGenerator,
    tfhePublicKeySerializer,
    compactPkeCrsSerializer,
    initTfhe,
  });
}
