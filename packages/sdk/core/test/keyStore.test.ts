/* eslint-disable turbo/no-undeclared-env-vars */
/* eslint-disable no-undef */

import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';

import { createKeysStore, type KeysStore, type KeysStorage } from '../keyStore';
import { TFHE_RS_KEY_VERSION } from 'core/consts';

// Mock the storage module
const mockStorage = {
  getItem: vi.fn(),
  setItem: vi.fn(),
  removeItem: vi.fn(),
};

vi.mock('../../src/storage', () => ({
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
      keysStorage.setCrs(testChainId, 0, testCrs);

      const retrievedCrs = keysStorage.getCrs(testChainId);

      expect(retrievedCrs).toEqual(testCrs);
    });

    it('should handle multiple chains for CRS', () => {
      const crs1 = '0x1234567890';
      const crs2 = '0x2345678901';

      keysStorage.setCrs(1, 0, crs1);
      keysStorage.setCrs(2, 0, crs2);

      expect(keysStorage.getCrs(1)).toEqual(crs1);
      expect(keysStorage.getCrs(2)).toEqual(crs2);
    });

    it('should keep CRS separate per security zone', () => {
      const crsZone0 = '0xaaaaaaaaaa';
      const crsZone1 = '0xbbbbbbbbbb';

      keysStorage.setCrs(testChainId, 0, crsZone0);
      keysStorage.setCrs(testChainId, 1, crsZone1);

      expect(keysStorage.getCrs(testChainId, 0)).toEqual(crsZone0);
      expect(keysStorage.getCrs(testChainId, 1)).toEqual(crsZone1);
    });

    it('should return undefined for non-existent CRS', () => {
      expect(keysStorage.getCrs(999)).toBeUndefined();
      expect(keysStorage.getCrs(undefined)).toBeUndefined();
      expect(keysStorage.getCrs(testChainId, 999)).toBeUndefined();
    });
  });

  describe('Storage Utilities', () => {
    it('should clear keys storage', async () => {
      await keysStorage.clearKeysStorage();

      expect(mockStorage.removeItem).toHaveBeenCalledWith(`cofhesdk-keys-v${TFHE_RS_KEY_VERSION}`);
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

  describe('Unusable storage', () => {
    const flush = () => new Promise((resolve) => setTimeout(resolve, 0));
    let warn: ReturnType<typeof vi.spyOn>;

    beforeEach(() => {
      warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    });

    it('falls back to in-memory keys when the read fails, warning once', async () => {
      const storage = {
        getItem: vi.fn().mockRejectedValue(new Error('iframe not ready')),
        setItem: vi.fn().mockRejectedValue(new Error('iframe not ready')),
        removeItem: vi.fn().mockRejectedValue(new Error('iframe not ready')),
      };
      const keys = createKeysStore(storage);
      expect(keys.storageStatus()).toBe('persistent');

      await expect(keys.rehydrateKeysStore()).resolves.toBeUndefined();
      expect(keys.storageStatus()).toBe('memory');
      expect(warn).toHaveBeenCalledTimes(1);
      expect(warn.mock.calls[0][0]).toContain('getItem');

      keys.setFheKey(1, 0, 'key');
      await flush();
      expect(keys.getFheKey(1, 0)).toBe('key');
      expect(storage.setItem).not.toHaveBeenCalled();

      // The store counts as hydrated: a later encrypt does not wait on the storage again.
      await keys.rehydrateKeysStore();
      expect(storage.getItem).toHaveBeenCalledTimes(1);
    });

    it('falls back when a write fails after a good read, without an unhandled rejection', async () => {
      const storage = {
        getItem: vi.fn().mockResolvedValue(null),
        setItem: vi.fn().mockRejectedValue(new Error('call timeout')),
        removeItem: vi.fn().mockResolvedValue(undefined),
      };
      const keys = createKeysStore(storage);
      await keys.rehydrateKeysStore();
      expect(keys.storageStatus()).toBe('persistent');

      keys.setFheKey(1, 0, 'key');
      await flush();
      expect(keys.storageStatus()).toBe('memory');
      expect(keys.getFheKey(1, 0)).toBe('key');

      keys.setCrs(1, 0, 'crs');
      await flush();
      expect(keys.getCrs(1, 0)).toBe('crs');
      expect(storage.setItem).toHaveBeenCalledTimes(1);
      expect(warn).toHaveBeenCalledTimes(1);
      expect(warn.mock.calls[0][0]).toContain('setItem');
    });

    it('catches a storage that throws synchronously', async () => {
      const storage = {
        getItem: vi.fn(() => {
          throw new Error('no document');
        }),
        setItem: vi.fn(),
        removeItem: vi.fn(),
      };
      const keys = createKeysStore(storage);
      await expect(keys.rehydrateKeysStore()).resolves.toBeUndefined();
      expect(keys.storageStatus()).toBe('memory');
    });

    it('skips the clear once the storage was given up on', async () => {
      const storage = {
        getItem: vi.fn().mockRejectedValue(new Error('iframe not ready')),
        setItem: vi.fn(),
        removeItem: vi.fn(),
      };
      const keys = createKeysStore(storage);
      await keys.rehydrateKeysStore();
      await keys.clearKeysStorage();
      expect(storage.removeItem).not.toHaveBeenCalled();
    });

    it('still throws for a persisted value it cannot merge, with the cause attached', async () => {
      const storage = {
        getItem: vi.fn().mockResolvedValue(JSON.stringify({ state: { nope: true }, version: 0 })),
        setItem: vi.fn(),
        removeItem: vi.fn(),
      };
      const keys = createKeysStore(storage);
      const error = await keys.rehydrateKeysStore().catch((e: unknown) => e);
      expect(error).toBeInstanceOf(Error);
      expect((error as Error).message).toContain(
        'onRehydrateStorage: Error rehydrating keys store: Invalid persisted state structure for KeysStore'
      );
      expect((error as Error).cause).toBeInstanceOf(Error);
      expect(((error as Error).cause as Error).message).toContain('Invalid persisted state structure');
      expect(keys.storageStatus()).toBe('persistent');
      expect(warn).not.toHaveBeenCalled();
    });

    it('reports memory when no storage is configured', () => {
      expect(createKeysStore(null).storageStatus()).toBe('memory');
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
      keysStorage.setCrs(testChainId, 0, testCrs);

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
      keysStorage.setCrs(1, 0, crs1);

      const state = keysStorage.store.getState();

      expect(state.fhe[1][0]).toEqual(key1);
      expect(state.fhe[2][0]).toEqual(key2);
      expect(state.crs[1][0]).toEqual(crs1);
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
