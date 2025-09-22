import { createStore } from 'zustand/vanilla';
import { persist, createJSONStorage } from 'zustand/middleware';
import { produce } from 'immer';
import { getStorage } from './storage';

// Type definitions
type ChainRecord<T> = Record<string, T>;
type SecurityZoneRecord<T> = Record<number, T>;

// Keys store for FHE keys and CRS
export type KeysStore = {
  fhe: ChainRecord<SecurityZoneRecord<Uint8Array | undefined>>;
  crs: ChainRecord<Uint8Array | undefined>;
};

export const keysStore = createStore<KeysStore>()(
  persist(
    () => ({
      fhe: {},
      crs: {},
    }),
    {
      name: 'cofhesdk-keys',
      storage: createJSONStorage(() => getStorage()),
    }
  )
);

// Utility functions for keys store
export const getFheKey = (chainId: number | undefined, securityZone = 0) => {
  if (chainId == null || securityZone == null) return undefined;
  const stored = keysStore.getState().fhe[chainId]?.[securityZone];
  return stored ? new Uint8Array(stored) : undefined;
};

export const getCrs = (chainId: number | undefined) => {
  if (chainId == null) return undefined;
  const stored = keysStore.getState().crs[chainId];
  return stored ? new Uint8Array(stored) : undefined;
};

export const setFheKey = (chainId: number, securityZone: number, key: Uint8Array) => {
  keysStore.setState(
    produce<KeysStore>((state: KeysStore) => {
      if (state.fhe[chainId] == null) state.fhe[chainId] = {};
      state.fhe[chainId][securityZone] = key;
    })
  );
};

export const setCrs = (chainId: number, crs: Uint8Array) => {
  keysStore.setState(
    produce<KeysStore>((state: KeysStore) => {
      state.crs[chainId] = crs;
    })
  );
};

// Storage utilities
export const clearKeysStorage = async () => {
  const storage = getStorage();
  await storage.removeItem('cofhesdk-keys');
};

export const rehydrateKeysStore = async () => {
  // Ensure persisted keys store is loaded
  if (keysStore.persist?.rehydrate) {
    await keysStore.persist.rehydrate();
  }
};

// Export main keys storage object
export const keysStorage = {
  store: keysStore,

  // Key utilities
  getFheKey,
  getCrs,
  setFheKey,
  setCrs,

  // Storage utilities
  clearKeysStorage,
  rehydrateKeysStore,
};
