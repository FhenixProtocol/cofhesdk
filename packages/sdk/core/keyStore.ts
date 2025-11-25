/* eslint-disable no-unused-vars */
import { createStore, type StoreApi } from 'zustand/vanilla';
import { persist, createJSONStorage } from 'zustand/middleware';
import { produce } from 'immer';
import { type IStorage } from './types.js';

// Type definitions
type ChainRecord<T> = Record<string, T>;
type SecurityZoneRecord<T> = Record<number, T>;

// Keys store for FHE keys and CRS
export type KeysStore = {
  fhe: ChainRecord<SecurityZoneRecord<string | undefined>>;
  crs: ChainRecord<string | undefined>;
};

export type KeysStorage = {
  store: StoreApi<KeysStore>;
  getFheKey: (chainId: number | undefined, securityZone?: number) => string | undefined;
  getCrs: (chainId: number | undefined) => string | undefined;
  setFheKey: (chainId: number, securityZone: number, key: string) => void;
  setCrs: (chainId: number, crs: string) => void;
  clearKeysStorage: () => Promise<void>;
  rehydrateKeysStore: (args?: any) => Promise<void>;
};

function isValidPersistedState(state: unknown): state is KeysStore {
  if (state && typeof state === 'object') {
    if ('fhe' in state && 'crs' in state) {
      return true;
    } else {
      throw new Error(
        "Invalid persisted state structure for KeysStore. Is object but doesn't contain required fields 'fhe' and 'crs'."
      );
    }
  }

  return false;
}

const DEFAULT_KEYS_STORE: KeysStore = {
  fhe: {},
  crs: {},
};

/**
 * Creates a keys storage instance using the provided storage implementation
 * @param storage - The storage implementation to use (IStorage interface), or null for non-persisted store
 * @returns A KeysStorage instance with all utility methods
 */
export function createKeysStore(storage: IStorage | null): KeysStorage {
  // Conditionally create store with or without persist wrapper
  const keysStore = storage
    ? createStore<KeysStore>()(
        persist(() => DEFAULT_KEYS_STORE, {
          // because earleir tests were written with on-init hydration skipped (due to the error suppression in zustand), returning this flag to fix test (i.e. KeyStore > Storage Utilities > should rehydrate keys store)
          skipHydration: true,
          // if onRehydrateStorage is not passed here, the errors thrown by storage layer are swallowed by zustand here: https://github.com/pmndrs/zustand/blob/39a391b6c1ff9aa89b81694d9bdb21da37dd4ac6/src/middleware/persist.ts#L321
          onRehydrateStorage: () => (_state?, _error?) => {
            if (_error) throw new Error(`onRehydrateStorage: Error rehydrating keys store: ${_error}`);
          },
          name: 'cofhesdk-keys',
          storage: createJSONStorage(() => storage),
          merge: (persistedState, currentState) => {
            const persisted = isValidPersistedState(persistedState) ? persistedState : DEFAULT_KEYS_STORE;
            const current = currentState as KeysStore;

            // Deep merge for fhe
            const mergedFhe: KeysStore['fhe'] = { ...persisted.fhe };
            const allChainIds = new Set([...Object.keys(current.fhe), ...Object.keys(persisted.fhe)]);
            for (const chainId of allChainIds) {
              const persistedZones = persisted.fhe[chainId] || {};
              const currentZones = current.fhe[chainId] || {};
              mergedFhe[chainId] = { ...persistedZones, ...currentZones };
            }

            // Deep merge for crs
            const mergedCrs: KeysStore['crs'] = { ...persisted.crs, ...current.crs };

            return {
              fhe: mergedFhe,
              crs: mergedCrs,
            };
          },
        })
      )
    : createStore<KeysStore>()(() => ({
        fhe: {},
        crs: {},
      }));

  // Utility functions

  const getFheKey = (chainId: number | undefined, securityZone = 0) => {
    if (chainId == null || securityZone == null) return undefined;
    const stored = keysStore.getState().fhe[chainId]?.[securityZone];
    return stored;
  };

  const getCrs = (chainId: number | undefined) => {
    if (chainId == null) return undefined;
    const stored = keysStore.getState().crs[chainId];
    return stored;
  };

  const setFheKey = (chainId: number, securityZone: number, key: string) => {
    keysStore.setState(
      produce<KeysStore>((state: KeysStore) => {
        if (state.fhe[chainId] == null) state.fhe[chainId] = {};
        state.fhe[chainId][securityZone] = key;
      })
    );
  };

  const setCrs = (chainId: number, crs: string) => {
    keysStore.setState(
      produce<KeysStore>((state: KeysStore) => {
        state.crs[chainId] = crs;
      })
    );
  };

  const clearKeysStorage = async () => {
    if (storage) {
      await storage.removeItem('cofhesdk-keys');
    }
    // If no storage, this is a no-op
  };

  const rehydrateKeysStore = async (...args: any) => {
    console.log('Rehydrating keys store with args:', args);
    if ('persist' in keysStore) {
      console.log('Rehydrating keys store with args: persist is in keystore', args);
      console.log('has rehydrated?:', (keysStore.persist as any).hasHydrated(), args);
      if ((keysStore.persist as any).hasHydrated()) return;
      await (keysStore.persist as any).rehydrate();
      console.log('after rehydrated:', args);
    }
  };

  return {
    store: keysStore,
    getFheKey,
    getCrs,
    setFheKey,
    setCrs,
    clearKeysStorage,
    rehydrateKeysStore,
  };
}
