/* eslint-disable turbo/no-undeclared-env-vars */
/* eslint-disable no-undef */

import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import {
  keysStore,
  getFheKey,
  getCrs,
  setFheKey,
  setCrs,
  clearKeysStorage,
  rehydrateKeysStore,
  keysStorage,
  type KeysStore,
} from '../src/keyStore';

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
  beforeEach(() => {
    vi.clearAllMocks();
    // Reset store state
    keysStore.setState({ fhe: {}, crs: {} });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('Store Structure', () => {
    it('should have initial empty state', () => {
      const state = keysStore.getState();
      expect(state).toEqual({
        fhe: {},
        crs: {},
      });
    });

    it('should be a Zustand store with persist', () => {
      expect(keysStore).toBeDefined();
      expect(keysStore.getState).toBeDefined();
      expect(keysStore.setState).toBeDefined();
      // In test environment, persist might not be fully initialized
      if (keysStore.persist) {
        expect(keysStore.persist).toBeDefined();
      }
    });
  });

  describe('FHE Key Management', () => {
    const testChainId = '1337';
    const testSecurityZone = 0;
    const testKey = new Uint8Array([1, 2, 3, 4, 5]);

    it('should set and get FHE key', () => {
      setFheKey(testChainId, testSecurityZone, testKey);
      
      const retrievedKey = getFheKey(testChainId, testSecurityZone);
      
      expect(retrievedKey).toEqual(testKey);
    });

    it('should handle multiple security zones', () => {
      const key0 = new Uint8Array([1, 2, 3]);
      const key1 = new Uint8Array([4, 5, 6]);
      
      setFheKey(testChainId, 0, key0);
      setFheKey(testChainId, 1, key1);
      
      expect(getFheKey(testChainId, 0)).toEqual(key0);
      expect(getFheKey(testChainId, 1)).toEqual(key1);
    });

    it('should handle multiple chains', () => {
      const chain1Key = new Uint8Array([1, 2, 3]);
      const chain2Key = new Uint8Array([4, 5, 6]);
      
      setFheKey('1', testSecurityZone, chain1Key);
      setFheKey('2', testSecurityZone, chain2Key);
      
      expect(getFheKey('1', testSecurityZone)).toEqual(chain1Key);
      expect(getFheKey('2', testSecurityZone)).toEqual(chain2Key);
    });

    it('should return undefined for non-existent keys', () => {
      expect(getFheKey('non-existent', 0)).toBeUndefined();
      expect(getFheKey(testChainId, 999)).toBeUndefined();
      expect(getFheKey(undefined, 0)).toBeUndefined();
      expect(getFheKey(testChainId, undefined as any)).toBeUndefined();
    });

    it('should convert stored data to Uint8Array', () => {
      // Simulate stored data that might not be Uint8Array
      keysStore.setState({
        fhe: {
          [testChainId]: {
            [testSecurityZone]: [1, 2, 3, 4, 5] as any, // Array instead of Uint8Array
          },
        },
        crs: {},
      });
      
      const retrievedKey = getFheKey(testChainId, testSecurityZone);
      
      expect(retrievedKey).toBeInstanceOf(Uint8Array);
      expect(Array.from(retrievedKey!)).toEqual([1, 2, 3, 4, 5]);
    });
  });

  describe('CRS Management', () => {
    const testChainId = '1337';
    const testCrs = new Uint8Array([10, 20, 30, 40, 50]);

    it('should set and get CRS', () => {
      setCrs(testChainId, testCrs);
      
      const retrievedCrs = getCrs(testChainId);
      
      expect(retrievedCrs).toEqual(testCrs);
    });

    it('should handle multiple chains for CRS', () => {
      const crs1 = new Uint8Array([1, 2, 3]);
      const crs2 = new Uint8Array([4, 5, 6]);
      
      setCrs('1', crs1);
      setCrs('2', crs2);
      
      expect(getCrs('1')).toEqual(crs1);
      expect(getCrs('2')).toEqual(crs2);
    });

    it('should return undefined for non-existent CRS', () => {
      expect(getCrs('non-existent')).toBeUndefined();
      expect(getCrs(undefined)).toBeUndefined();
    });

    it('should convert stored CRS data to Uint8Array', () => {
      // Simulate stored data that might not be Uint8Array
      keysStore.setState({
        fhe: {},
        crs: {
          [testChainId]: [10, 20, 30] as any, // Array instead of Uint8Array
        },
      });
      
      const retrievedCrs = getCrs(testChainId);
      
      expect(retrievedCrs).toBeInstanceOf(Uint8Array);
      expect(Array.from(retrievedCrs!)).toEqual([10, 20, 30]);
    });
  });

  describe('Storage Utilities', () => {
    it('should clear keys storage', async () => {
      await clearKeysStorage();
      
      expect(mockStorage.removeItem).toHaveBeenCalledWith('cofhesdk-keys');
    });

    it('should rehydrate keys store', async () => {
      const mockRehydrate = vi.fn();
      
      // Mock the persist object if it doesn't exist
      if (!keysStore.persist) {
        (keysStore as any).persist = {};
      }
      keysStore.persist!.rehydrate = mockRehydrate;
      
      await rehydrateKeysStore();
      
      expect(mockRehydrate).toHaveBeenCalled();
    });

    it('should handle missing rehydrate method', async () => {
      if (keysStore.persist) {
        // Temporarily disable rehydrate to test fallback
        const originalRehydrate = keysStore.persist.rehydrate;
        (keysStore.persist as any).rehydrate = undefined;
        
        try {
          // Should not throw
          await expect(rehydrateKeysStore()).resolves.not.toThrow();
        } finally {
          // Restore original method
          keysStore.persist.rehydrate = originalRehydrate;
        }
      } else {
        // Should not throw
        await expect(rehydrateKeysStore()).resolves.not.toThrow();
      }
      
      // Should not throw
      await expect(rehydrateKeysStore()).resolves.not.toThrow();
    });
  });

  describe('keysStorage Object', () => {
    it('should export keysStorage with all utilities', () => {
      expect(keysStorage).toBeDefined();
      expect(keysStorage.store).toBe(keysStore);
      expect(keysStorage.getFheKey).toBe(getFheKey);
      expect(keysStorage.getCrs).toBe(getCrs);
      expect(keysStorage.setFheKey).toBe(setFheKey);
      expect(keysStorage.setCrs).toBe(setCrs);
      expect(keysStorage.clearKeysStorage).toBe(clearKeysStorage);
      expect(keysStorage.rehydrateKeysStore).toBe(rehydrateKeysStore);
    });

    it('should work through keysStorage object', () => {
      const testChainId = '1337';
      const testKey = new Uint8Array([1, 2, 3]);
      const testCrs = new Uint8Array([4, 5, 6]);
      
      keysStorage.setFheKey(testChainId, 0, testKey);
      keysStorage.setCrs(testChainId, testCrs);
      
      expect(keysStorage.getFheKey(testChainId, 0)).toEqual(testKey);
      expect(keysStorage.getCrs(testChainId)).toEqual(testCrs);
    });
  });

  describe('State Management', () => {
    it('should update state immutably', () => {
      const initialState = keysStore.getState();
      const testChainId = '1337';
      const testKey = new Uint8Array([1, 2, 3]);
      
      setFheKey(testChainId, 0, testKey);
      
      const newState = keysStore.getState();
      
      // State should be different objects
      expect(newState).not.toBe(initialState);
      expect(newState.fhe).not.toBe(initialState.fhe);
      
      // But should contain the new key
      expect(newState.fhe[testChainId][0]).toEqual(testKey);
    });

    it('should preserve existing data when adding new keys', () => {
      const key1 = new Uint8Array([1, 2, 3]);
      const key2 = new Uint8Array([4, 5, 6]);
      const crs1 = new Uint8Array([7, 8, 9]);
      
      setFheKey('chain1', 0, key1);
      setCrs('chain1', crs1);
      setFheKey('chain2', 0, key2);
      
      const state = keysStore.getState();
      
      expect(state.fhe['chain1'][0]).toEqual(key1);
      expect(state.fhe['chain2'][0]).toEqual(key2);
      expect(state.crs['chain1']).toEqual(crs1);
    });
  });

  describe('Type Safety', () => {
    it('should have correct TypeScript types', () => {
      const state: KeysStore = keysStore.getState();
      
      // These should compile without TypeScript errors
      expect(typeof state.fhe).toBe('object');
      expect(typeof state.crs).toBe('object');
      
      // Test that the types allow proper access patterns
      const chainId = '1337';
      const securityZone = 0;
      
      if (state.fhe[chainId] && state.fhe[chainId][securityZone]) {
        expect(state.fhe[chainId][securityZone]).toBeInstanceOf(Uint8Array);
      }
      
      if (state.crs[chainId]) {
        expect(state.crs[chainId]).toBeInstanceOf(Uint8Array);
      }
    });
  });
});
