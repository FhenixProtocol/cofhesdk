/* eslint-disable turbo/no-undeclared-env-vars */
/* eslint-disable no-undef */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { fetchKeys, fetchMultichainKeys } from '../src/fetchKeys';
import { CofhesdkConfig } from '../src/config';
import { keysStorage } from '../src/keyStore';
import { sepolia, arbSepolia } from '@cofhesdk/chains';

describe('fetchKeys', () => {
  let mockConfig: CofhesdkConfig;
  let mockTfhePublicKeySerializer: any;
  let mockCompactPkeCrsSerializer: any;

  beforeEach(async () => {
    // Reset all mocks
    vi.clearAllMocks();

    // Setup config with real chains
    mockConfig = {
      supportedChains: [sepolia, arbSepolia],
    };

    // Setup mock serializers
    mockTfhePublicKeySerializer = vi.fn();
    mockCompactPkeCrsSerializer = vi.fn();
  });

  afterEach(async () => {
    vi.restoreAllMocks();

    // Clear store and storage
    await keysStorage.clearKeysStorage();
    keysStorage.store.setState({ fhe: {}, crs: {} });
  });

  describe('Success Cases', () => {
    it('should fetch and store FHE public key and CRS for Sepolia when not cached', async () => {
      await fetchKeys(mockConfig, sepolia.id, 0, mockTfhePublicKeySerializer, mockCompactPkeCrsSerializer);

      // Verify keys were stored
      const storedFheKey = keysStorage.getFheKey(sepolia.id, 0);
      const storedCrs = keysStorage.getCrs(sepolia.id);

      expect(storedFheKey).toBeDefined();
      expect(storedCrs).toBeDefined();
      expect(mockTfhePublicKeySerializer).toHaveBeenCalled();
      expect(mockCompactPkeCrsSerializer).toHaveBeenCalled();
    });

    it('should fetch and store FHE public key and CRS for Arbitrum Sepolia when not cached', async () => {
      await fetchKeys(mockConfig, arbSepolia.id, 0, mockTfhePublicKeySerializer, mockCompactPkeCrsSerializer);

      // Verify keys were stored
      const storedFheKey = keysStorage.getFheKey(arbSepolia.id, 0);
      const storedCrs = keysStorage.getCrs(arbSepolia.id);

      expect(storedFheKey).toBeDefined();
      expect(storedCrs).toBeDefined();
      expect(mockTfhePublicKeySerializer).toHaveBeenCalled();
      expect(mockCompactPkeCrsSerializer).toHaveBeenCalled();
    });
  });

  describe('Caching Behavior', () => {
    it('should not fetch FHE key if already cached', async () => {
      // Pre-populate with a cached key
      const mockCachedKey = new Uint8Array([1, 2, 3]);
      keysStorage.setFheKey(sepolia.id, 0, mockCachedKey);

      await fetchKeys(mockConfig, sepolia.id, 0, mockTfhePublicKeySerializer, mockCompactPkeCrsSerializer);

      // Verify the cached key wasn't overwritten
      const retrievedKey = keysStorage.getFheKey(sepolia.id, 0);
      expect(retrievedKey).toEqual(mockCachedKey);

      // Verify CRS was still fetched
      const retrievedCrs = keysStorage.getCrs(sepolia.id);
      expect(retrievedCrs).toBeDefined();
    });

    it('should not fetch CRS if already cached', async () => {
      // Pre-populate with a cached CRS
      const mockCachedCrs = new Uint8Array([4, 5, 6]);
      keysStorage.setCrs(sepolia.id, mockCachedCrs);

      await fetchKeys(mockConfig, sepolia.id, 0, mockTfhePublicKeySerializer, mockCompactPkeCrsSerializer);

      // Verify the cached CRS wasn't overwritten
      const retrievedCrs = keysStorage.getCrs(sepolia.id);
      expect(retrievedCrs).toEqual(mockCachedCrs);

      // Verify FHE key was still fetched
      const retrievedKey = keysStorage.getFheKey(sepolia.id, 0);
      expect(retrievedKey).toBeDefined();
    });

    it('should not make any network calls if both keys are cached', async () => {
      // Pre-populate both keys
      const mockCachedKey = new Uint8Array([1, 2, 3]);
      const mockCachedCrs = new Uint8Array([4, 5, 6]);
      keysStorage.setFheKey(sepolia.id, 0, mockCachedKey);
      keysStorage.setCrs(sepolia.id, mockCachedCrs);

      await fetchKeys(mockConfig, sepolia.id, 0, mockTfhePublicKeySerializer, mockCompactPkeCrsSerializer);

      // Verify both keys remain unchanged
      const retrievedKey = keysStorage.getFheKey(sepolia.id, 0);
      const retrievedCrs = keysStorage.getCrs(sepolia.id);

      expect(retrievedKey).toEqual(mockCachedKey);
      expect(retrievedCrs).toEqual(mockCachedCrs);
    });
  });

  describe('Error Handling', () => {
    beforeEach(async () => {
      await keysStorage.clearKeysStorage();
      keysStorage.store.setState({ fhe: {}, crs: {} });
    });

    it('should throw error for unsupported chain ID', async () => {
      await expect(
        fetchKeys(
          mockConfig,
          999, // Non-existent chain
          0,
          mockTfhePublicKeySerializer,
          mockCompactPkeCrsSerializer
        )
      ).rejects.toThrow('Error fetching keys; coFheUrl not found in config for chainId 999');
    });

    it('should throw error when FHE public key serialization fails', async () => {
      mockTfhePublicKeySerializer.mockImplementation(() => {
        throw new Error('Serialization failed');
      });

      await expect(
        fetchKeys(mockConfig, sepolia.id, 0, mockTfhePublicKeySerializer, mockCompactPkeCrsSerializer)
      ).rejects.toThrow('Error serializing FHE publicKey; Error: Serialization failed');
    });

    it('should throw error when CRS serialization fails', async () => {
      const existingCrs = keysStorage.getCrs(sepolia.id);
      console.log('existingCrs', existingCrs);

      mockCompactPkeCrsSerializer.mockImplementation(() => {
        throw new Error('Serialization failed');
      });

      await expect(
        fetchKeys(mockConfig, sepolia.id, 0, mockTfhePublicKeySerializer, mockCompactPkeCrsSerializer)
      ).rejects.toThrow('Error serializing CRS; Error: Serialization failed');
    });
  });

  describe('fetchMultichainKeys', () => {
    it('should fetch and store FHE public key and CRS for all chains in the config', async () => {
      await fetchMultichainKeys(mockConfig, 0, mockTfhePublicKeySerializer, mockCompactPkeCrsSerializer);

      // Verify keys were stored
      const storedFheKey = keysStorage.getFheKey(sepolia.id, 0);
      const storedCrs = keysStorage.getCrs(sepolia.id);
      const storedFheKeyArb = keysStorage.getFheKey(arbSepolia.id, 0);
      const storedCrsArb = keysStorage.getCrs(arbSepolia.id);

      expect(storedFheKey).toBeDefined();
      expect(storedCrs).toBeDefined();
      expect(storedFheKeyArb).toBeDefined();
      expect(storedCrsArb).toBeDefined();
      expect(mockTfhePublicKeySerializer).toHaveBeenCalled();
      expect(mockCompactPkeCrsSerializer).toHaveBeenCalled();
    });
  });
});
