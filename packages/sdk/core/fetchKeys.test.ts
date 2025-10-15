/* eslint-disable turbo/no-undeclared-env-vars */
/* eslint-disable no-undef */

import { sepolia, arbSepolia } from '@/chains';

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { fetchKeys, fetchMultichainKeys } from './fetchKeys.js';
import { type CofhesdkConfig, createCofhesdkConfig } from './config.js';
import { createKeysStore, type KeysStorage } from './keyStore.js';

describe('fetchKeys', () => {
  let config: CofhesdkConfig;
  let mockTfhePublicKeyDeserializer: any;
  let mockCompactPkeCrsDeserializer: any;
  let keysStorage: KeysStorage;

  beforeEach(async () => {
    // Reset all mocks
    vi.clearAllMocks();

    // Setup config with real chains
    config = createCofhesdkConfig({
      supportedChains: [sepolia, arbSepolia],
    });

    // Setup mock serializers
    mockTfhePublicKeyDeserializer = vi.fn();
    mockCompactPkeCrsDeserializer = vi.fn();

    // Create a fresh keysStorage instance for each test (non-persisted)
    keysStorage = createKeysStore(null);
  });

  afterEach(async () => {
    vi.restoreAllMocks();
  });

  it('should fetch and store FHE public key and CRS for Sepolia when not cached', async () => {
    await fetchKeys(config, sepolia.id, 0, mockTfhePublicKeyDeserializer, mockCompactPkeCrsDeserializer, keysStorage);

    // Verify keys were stored
    const storedFheKey = keysStorage.getFheKey(sepolia.id, 0);
    const storedCrs = keysStorage.getCrs(sepolia.id);

    expect(storedFheKey).toBeDefined();
    expect(storedCrs).toBeDefined();
    expect(mockTfhePublicKeyDeserializer).toHaveBeenCalled();
    expect(mockCompactPkeCrsDeserializer).toHaveBeenCalled();
  });

  it('should fetch and store FHE public key and CRS for Arbitrum Sepolia when not cached', async () => {
    await fetchKeys(
      config,
      arbSepolia.id,
      0,
      mockTfhePublicKeyDeserializer,
      mockCompactPkeCrsDeserializer,
      keysStorage
    );

    // Verify keys were stored
    const storedFheKey = keysStorage.getFheKey(arbSepolia.id, 0);
    const storedCrs = keysStorage.getCrs(arbSepolia.id);

    expect(storedFheKey).toBeDefined();
    expect(storedCrs).toBeDefined();
    expect(mockTfhePublicKeyDeserializer).toHaveBeenCalled();
    expect(mockCompactPkeCrsDeserializer).toHaveBeenCalled();
  });

  it('should not fetch FHE key if already cached', async () => {
    // Pre-populate with a cached key
    const mockCachedKey = '0x1234567890';
    keysStorage.setFheKey(sepolia.id, 0, mockCachedKey);

    await fetchKeys(config, sepolia.id, 0, mockTfhePublicKeyDeserializer, mockCompactPkeCrsDeserializer, keysStorage);

    // Verify the cached key wasn't overwritten
    const retrievedKey = keysStorage.getFheKey(sepolia.id, 0);
    expect(retrievedKey).toEqual(mockCachedKey);

    // Verify CRS was still fetched
    const retrievedCrs = keysStorage.getCrs(sepolia.id);
    expect(retrievedCrs).toBeDefined();
  });

  it('should not fetch CRS if already cached', async () => {
    // Pre-populate with a cached CRS
    const mockCachedCrs = '0x2345678901';
    keysStorage.setCrs(sepolia.id, mockCachedCrs);

    await fetchKeys(config, sepolia.id, 0, mockTfhePublicKeyDeserializer, mockCompactPkeCrsDeserializer, keysStorage);

    // Verify the cached CRS wasn't overwritten
    const retrievedCrs = keysStorage.getCrs(sepolia.id);
    expect(retrievedCrs).toEqual(mockCachedCrs);

    // Verify FHE key was still fetched
    const retrievedKey = keysStorage.getFheKey(sepolia.id, 0);
    expect(retrievedKey).toBeDefined();
  });

  it('should not make any network calls if both keys are cached', async () => {
    // Pre-populate both keys
    const mockCachedKey = '0x1234567890';
    const mockCachedCrs = '0x2345678901';
    keysStorage.setFheKey(sepolia.id, 0, mockCachedKey);
    keysStorage.setCrs(sepolia.id, mockCachedCrs);

    await fetchKeys(config, sepolia.id, 0, mockTfhePublicKeyDeserializer, mockCompactPkeCrsDeserializer, keysStorage);

    // Verify both keys remain unchanged
    const retrievedKey = keysStorage.getFheKey(sepolia.id, 0);
    const retrievedCrs = keysStorage.getCrs(sepolia.id);

    expect(retrievedKey).toEqual(mockCachedKey);
    expect(retrievedCrs).toEqual(mockCachedCrs);
  });

  it('should throw error for unsupported chain ID', async () => {
    await expect(
      fetchKeys(
        config,
        999, // Non-existent chain
        0,
        mockTfhePublicKeyDeserializer,
        mockCompactPkeCrsDeserializer,
        keysStorage
      )
    ).rejects.toThrow('Config does not support chain <999>');
  });

  it('should throw error when FHE public key serialization fails', async () => {
    mockTfhePublicKeyDeserializer.mockImplementation(() => {
      throw new Error('Serialization failed');
    });

    await expect(
      fetchKeys(config, sepolia.id, 0, mockTfhePublicKeyDeserializer, mockCompactPkeCrsDeserializer, keysStorage)
    ).rejects.toThrow('Error serializing FHE publicKey; Error: Serialization failed');
  });

  it('should throw error when CRS serialization fails', async () => {
    mockCompactPkeCrsDeserializer.mockImplementation(() => {
      throw new Error('Serialization failed');
    });

    await expect(
      fetchKeys(config, sepolia.id, 0, mockTfhePublicKeyDeserializer, mockCompactPkeCrsDeserializer, keysStorage)
    ).rejects.toThrow('Error serializing CRS; Error: Serialization failed');
  });

  it('should fetch and store FHE public key and CRS for all chains in the config', async () => {
    await fetchMultichainKeys(config, 0, mockTfhePublicKeyDeserializer, mockCompactPkeCrsDeserializer, keysStorage);

    // Verify keys were stored
    const storedFheKey = keysStorage.getFheKey(sepolia.id, 0);
    const storedCrs = keysStorage.getCrs(sepolia.id);
    const storedFheKeyArb = keysStorage.getFheKey(arbSepolia.id, 0);
    const storedCrsArb = keysStorage.getCrs(arbSepolia.id);

    expect(storedFheKey).toBeDefined();
    expect(storedCrs).toBeDefined();
    expect(storedFheKeyArb).toBeDefined();
    expect(storedCrsArb).toBeDefined();
    expect(mockTfhePublicKeyDeserializer).toHaveBeenCalled();
    expect(mockCompactPkeCrsDeserializer).toHaveBeenCalled();
  });
});
