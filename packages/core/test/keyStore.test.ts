/* eslint-disable turbo/no-undeclared-env-vars */
/* eslint-disable no-undef */

import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { createKeysStore, type KeysStore, type KeysStorage } from '../src/keyStore';

// Mock the storage module
const mockStorage = {
  getItem: vi.fn(),
  setItem: vi.fn(),
  removeItem: vi.fn(),
};

vi.mock('../src/storage', () => ({
  getStorage: () => mockStorage,
}));

describe('KeyStore', () => {
  let keysStorage: KeysStorage;

  beforeEach(() => {
    vi.clearAllMocks();
    // Create a fresh keysStorage instance for each test (with mock storage)
    keysStorage = createKeysStore(mockStorage as any);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('Store Structure', () => {
    it('should have initial empty state', () => {
      const state = keysStorage.store.getState();
      expect(state).toEqual({
        fhe: {},
        crs: {},
      });
    });

    it('should be a Zustand store with persist', () => {
      expect(keysStorage.store).toBeDefined();
      expect(keysStorage.store.getState).toBeDefined();
      expect(keysStorage.store.setState).toBeDefined();
      // In test environment, persist might not be fully initialized
      if ('persist' in keysStorage.store) {
        expect((keysStorage.store as any).persist).toBeDefined();
      }
    });
  });

  describe('FHE Key Management', () => {
    const testChainId = 1337;
    const testSecurityZone = 0;
    const testKey = '0x1234567890';

    it('should set and get FHE key', () => {
      keysStorage.setFheKey(testChainId, testSecurityZone, testKey);

      const retrievedKey = keysStorage.getFheKey(testChainId, testSecurityZone);

      expect(retrievedKey).toEqual(testKey);
    });

    it('should handle multiple security zones', () => {
      const key0 = '0x1234567890';
      const key1 = '0x2345678901';

      keysStorage.setFheKey(testChainId, 0, key0);
      keysStorage.setFheKey(testChainId, 1, key1);

      expect(keysStorage.getFheKey(testChainId, 0)).toEqual(key0);
      expect(keysStorage.getFheKey(testChainId, 1)).toEqual(key1);
    });

    it('should handle multiple chains', () => {
      const chain1Key = '0x1234567890';
      const chain2Key = '0x2345678901';

      keysStorage.setFheKey(1, testSecurityZone, chain1Key);
      keysStorage.setFheKey(2, testSecurityZone, chain2Key);

      expect(keysStorage.getFheKey(1, testSecurityZone)).toEqual(chain1Key);
      expect(keysStorage.getFheKey(2, testSecurityZone)).toEqual(chain2Key);
    });

    it('should return undefined for non-existent keys', () => {
      expect(keysStorage.getFheKey(999, 0)).toBeUndefined();
      expect(keysStorage.getFheKey(testChainId, 999)).toBeUndefined();
      expect(keysStorage.getFheKey(undefined, 0)).toBeUndefined();
      expect(keysStorage.getFheKey(testChainId, undefined as any)).toBeUndefined();
    });
  });

  describe('CRS Management', () => {
    const testChainId = 1337;
    const testCrs = '0x1234567890';

    it('should set and get CRS', () => {
      keysStorage.setCrs(testChainId, testCrs);

      const retrievedCrs = keysStorage.getCrs(testChainId);

      expect(retrievedCrs).toEqual(testCrs);
    });

    it('should handle multiple chains for CRS', () => {
      const crs1 = '0x1234567890';
      const crs2 = '0x2345678901';

      keysStorage.setCrs(1, crs1);
      keysStorage.setCrs(2, crs2);

      expect(keysStorage.getCrs(1)).toEqual(crs1);
      expect(keysStorage.getCrs(2)).toEqual(crs2);
    });

    it('should return undefined for non-existent CRS', () => {
      expect(keysStorage.getCrs(999)).toBeUndefined();
      expect(keysStorage.getCrs(undefined)).toBeUndefined();
    });
  });

  describe('Storage Utilities', () => {
    it('should clear keys storage', async () => {
      await keysStorage.clearKeysStorage();

      expect(mockStorage.removeItem).toHaveBeenCalledWith('cofhesdk-keys');
    });

    it('should rehydrate keys store', async () => {
      const mockRehydrate = vi.fn();

      // Mock the persist object if it doesn't exist
      if (!('persist' in keysStorage.store)) {
        (keysStorage.store as any).persist = {};
      }
      (keysStorage.store as any).persist.rehydrate = mockRehydrate;

      await keysStorage.rehydrateKeysStore();

      expect(mockRehydrate).toHaveBeenCalled();
    });
  });

  describe('keysStorage Object', () => {
    it('should have all required methods', () => {
      expect(keysStorage).toBeDefined();
      expect(keysStorage.store).toBeDefined();
      expect(keysStorage.getFheKey).toBeDefined();
      expect(keysStorage.getCrs).toBeDefined();
      expect(keysStorage.setFheKey).toBeDefined();
      expect(keysStorage.setCrs).toBeDefined();
      expect(keysStorage.clearKeysStorage).toBeDefined();
      expect(keysStorage.rehydrateKeysStore).toBeDefined();
    });

    it('should work through keysStorage object', () => {
      const testChainId = 1337;
      const testKey = '0x1234567890';
      const testCrs = '0x2345678901';

      keysStorage.setFheKey(testChainId, 0, testKey);
      keysStorage.setCrs(testChainId, testCrs);

      expect(keysStorage.getFheKey(testChainId, 0)).toEqual(testKey);
      expect(keysStorage.getCrs(testChainId)).toEqual(testCrs);
    });
  });

  describe('State Management', () => {
    it('should update state immutably', () => {
      const initialState = keysStorage.store.getState();
      const testChainId = 1337;
      const testKey = '0x1234567890';

      keysStorage.setFheKey(testChainId, 0, testKey);

      const newState = keysStorage.store.getState();

      // State should be different objects
      expect(newState).not.toBe(initialState);
      expect(newState.fhe).not.toBe(initialState.fhe);

      // But should contain the new key
      expect(newState.fhe[testChainId][0]).toEqual(testKey);
    });

    it('should preserve existing data when adding new keys', () => {
      const key1 = '0x1234567890';
      const key2 = '0x2345678901';
      const crs1 = '0x3456789012';

      keysStorage.setFheKey(1, 0, key1);
      keysStorage.setFheKey(2, 0, key2);
      keysStorage.setCrs(1, crs1);

      const state = keysStorage.store.getState();

      expect(state.fhe[1][0]).toEqual(key1);
      expect(state.fhe[2][0]).toEqual(key2);
      expect(state.crs[1]).toEqual(crs1);
    });
  });

  describe('Type Safety', () => {
    it('should have correct TypeScript types', () => {
      const state: KeysStore = keysStorage.store.getState();

      // These should compile without TypeScript errors
      expect(typeof state.fhe).toBe('object');
      expect(typeof state.crs).toBe('object');

      // Test that the types allow proper access patterns
      const chainId = 1337;
      const securityZone = 0;

      if (state.fhe[chainId] && state.fhe[chainId][securityZone]) {
        expect(state.fhe[chainId][securityZone]).toBeInstanceOf(String);
      }

      if (state.crs[chainId]) {
        expect(state.crs[chainId]).toBeInstanceOf(String);
      }
    });
  });
});
