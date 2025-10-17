// Web specific functionality only

import {
  createCofhesdkClientBase,
  createCofhesdkConfigBase,
  type CofhesdkClient,
  type CofhesdkConfig,
  type CofhesdkInputConfig,
  type ZkBuilderAndCrsGenerator,
  type FheKeyDeserializer,
} from '@/core';

// Import web-specific storage (internal use only)
import { createWebStorage } from './storage.js';

// Import tfhe for web
import init, { init_panic_hook, TfheCompactPublicKey, ProvenCompactCiphertextList, CompactPkeCrs } from 'tfhe';

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
