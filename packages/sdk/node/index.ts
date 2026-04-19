// Node.js specific functionality only

import {
  createCofheClientBase,
  createCofheConfigBase,
  type CofheClient,
  type CofheConfig,
  type CofheInputConfig,
  type ZkBuilderAndCrsGenerator,
  type FheKeyDeserializer,
  TFHE_RS_SAFE_SERIALIZATION_SIZE_LIMIT,
} from '@/core';

// Import node-specific storage (internal use only)
import { createNodeStorage } from './storage.js';

// Import node-tfhe for Node.js
import { TfheCompactPublicKey, ProvenCompactCiphertextList, CompactPkeCrs, init_panic_hook } from 'node-tfhe';

/**
 * Internal function to initialize TFHE for Node.js
 * Called automatically on first encryption - users don't need to call this manually
 * @returns true if TFHE was initialized, false if already initialized
 */
let tfheInitialized = false;
async function initTfhe(): Promise<boolean> {
  if (tfheInitialized) return false;
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

const _deserializeTfhePublicKey = (buff: string): TfheCompactPublicKey => {
  return TfheCompactPublicKey.safe_deserialize(fromHexString(buff), TFHE_RS_SAFE_SERIALIZATION_SIZE_LIMIT);
};

const _deserializeCompactPkeCrs = (buff: string): CompactPkeCrs => {
  return CompactPkeCrs.safe_deserialize(fromHexString(buff), TFHE_RS_SAFE_SERIALIZATION_SIZE_LIMIT);
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
  const zkBuilder = ProvenCompactCiphertextList.builder(fhePublicKey);
  const zkCrs = _deserializeCompactPkeCrs(crs);

  return { zkBuilder, zkCrs };
};

/**
 * Creates a CoFHE configuration for Node.js with filesystem storage as default
 * @param config - The CoFHE input configuration (fheKeyStorage will default to filesystem if not provided)
 * @returns The CoFHE configuration with Node.js defaults applied
 */
export function createCofheConfig(config: CofheInputConfig): CofheConfig {
  return createCofheConfigBase({
    environment: 'node',
    ...config,
    fheKeyStorage: config.fheKeyStorage === null ? null : config.fheKeyStorage ?? createNodeStorage(),
  });
}

/**
 * Creates a CoFHE client instance for Node.js with node-tfhe automatically configured
 * TFHE will be initialized automatically on first encryption - no manual setup required
 * @param config - The CoFHE configuration (use createCofheConfig to create with Node.js defaults)
 * @returns The CoFHE client instance
 */
export function createCofheClient(config: CofheConfig): CofheClient {
  return createCofheClientBase({
    config,
    zkBuilderAndCrsGenerator,
    tfhePublicKeyDeserializer,
    compactPkeCrsDeserializer,
    initTfhe,
  });
}
