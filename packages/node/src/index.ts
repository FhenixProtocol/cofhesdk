// Re-export everything from core except createCofhesdkClient
export * from '@cofhesdk/core';

// Import node-tfhe for Node.js
import { TfheCompactPublicKey, ProvenCompactCiphertextList, CompactPkeCrs, init_panic_hook } from 'node-tfhe';

import {
  createCofhesdkClient as createCofhesdkClientCore,
  type CofhesdkClient,
  type CofhesdkConfig,
  type ZkBuilderAndCrsGenerator,
  type FheKeySerializer,
} from '@cofhesdk/core';

/**
 * Internal function to initialize TFHE for Node.js
 * Called automatically on first encryption - users don't need to call this manually
 * @internal
 */
let tfheInitialized = false;
async function initTfhe(): Promise<void> {
  if (tfheInitialized) return;
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
 * Creates a CoFHE SDK client instance for Node.js with node-tfhe automatically configured
 * TFHE will be initialized automatically on first encryption - no manual setup required
 * @param config - The CoFHE SDK configuration
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
