/* eslint-disable no-unused-vars */
import { createStore, StoreApi } from 'zustand/vanilla';
import { persist, createJSONStorage } from 'zustand/middleware';
import { produce } from 'immer';
import { IStorage } from './storage';

// Type definitions
type ChainRecord<T> = Record<string, T>;
type SecurityZoneRecord<T> = Record<number, T>;

// Keys store for FHE keys and CRS
export type KeysStore = {
  fhe: ChainRecord<SecurityZoneRecord<Uint8Array | undefined>>;
  crs: ChainRecord<Uint8Array | undefined>;
};

export type KeysStorage = {
  store: StoreApi<KeysStore>;
  getFheKey: (chainId: number | undefined, securityZone?: number) => Uint8Array | undefined;
  getCrs: (chainId: number | undefined) => Uint8Array | undefined;
  setFheKey: (chainId: number, securityZone: number, key: Uint8Array) => void;
  setCrs: (chainId: number, crs: Uint8Array) => void;
  clearKeysStorage: () => Promise<void>;
  rehydrateKeysStore: () => Promise<void>;
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
        persist(
          () => ({
            fhe: {},
            crs: {},
          }),
          {
            name: 'cofhesdk-keys',
            storage: createJSONStorage(() => storage),
            merge: (persistedState, currentState) => {
              const persisted = persistedState as KeysStore;
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
          }
        )
      )
    : createStore<KeysStore>()(() => ({
        fhe: {},
        crs: {},
      }));

  // Utility functions

  const getFheKey = (chainId: number | undefined, securityZone = 0) => {
    if (chainId == null || securityZone == null) return undefined;
    const stored = keysStore.getState().fhe[chainId]?.[securityZone];
    return stored ? new Uint8Array(stored) : undefined;
  };

  const getCrs = (chainId: number | undefined) => {
    if (chainId == null) return undefined;
    const stored = keysStore.getState().crs[chainId];
    return stored ? new Uint8Array(stored) : undefined;
  };

  const setFheKey = (chainId: number, securityZone: number, key: Uint8Array) => {
    keysStore.setState(
      produce<KeysStore>((state: KeysStore) => {
        if (state.fhe[chainId] == null) state.fhe[chainId] = {};
        state.fhe[chainId][securityZone] = key;
      })
    );
  };

  const setCrs = (chainId: number, crs: Uint8Array) => {
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

  const rehydrateKeysStore = async () => {
    if ('persist' in keysStore) {
      await (keysStore.persist as any).rehydrate();
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
