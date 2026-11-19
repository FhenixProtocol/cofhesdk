import { createStore, type StoreApi } from 'zustand/vanilla';
import { persist, createJSONStorage } from 'zustand/middleware';
import { produce } from 'immer';
import { type IStorage } from './types.js';
import { TFHE_RS_KEY_VERSION } from './consts.js';

// Type definitions
type ChainRecord<T> = Record<string, T>;
type SecurityZoneRecord<T> = Record<number, T>;

// Keys store for FHE keys and CRS
export type KeysStore = {
  fhe: ChainRecord<SecurityZoneRecord<string | undefined>>;
  crs: ChainRecord<SecurityZoneRecord<string | undefined>>;
};

/**
 * Where the keys live: `persistent` while they are mirrored to the configured storage, `memory`
 * when they only live in this session, because no storage was configured or because the storage
 * failed and was given up on (see `guardStorage`).
 */
export type KeysStorageStatus = 'persistent' | 'memory';

export type KeysStorage = {
  store: StoreApi<KeysStore>;
  getFheKey: (chainId: number | undefined, securityZone?: number) => string | undefined;
  getCrs: (chainId: number | undefined, securityZone?: number) => string | undefined;
  setFheKey: (chainId: number, securityZone: number, key: string) => void;
  setCrs: (chainId: number, securityZone: number, crs: string) => void;
  clearKeysStorage: () => Promise<void>;
  rehydrateKeysStore: () => Promise<void>;
  storageStatus: () => KeysStorageStatus;
};

const KEYSTORE_NAME = `cofhesdk-keys-v${TFHE_RS_KEY_VERSION}`;

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

function isSecurityZoneRecord(value: unknown): value is SecurityZoneRecord<string | undefined> {
  return value != null && typeof value === 'object';
}

type StoreWithPersist = ReturnType<typeof createStoreWithPersit>;

type GuardedStorage = IStorage & { status: () => KeysStorageStatus };

/**
 * Puts the configured storage behind a guard so that an unusable storage never breaks an encrypt.
 * The storage is only a cache: keys are fetched from CoFHE whenever the store lacks them, so giving
 * it up costs one refetch per page load, while an error from it used to surface in two ways:
 * - read path: zustand `persist` hands a failed `getItem` to `onRehydrateStorage`, which rethrows
 *   (see `createStoreWithPersit`), so every `encryptInputs` failed with REHYDRATE_KEYS_STORE_FAILED
 *   (an iframe-backed storage that never becomes ready, a blocked IndexedDB);
 * - write path: `persist` calls `void setItem()` after each `setState`, so a failed `setItem`
 *   escaped as an unhandled promise rejection, after the encrypt had already succeeded.
 * On the first failure in either direction the guard warns once and turns the storage into a no-op
 * for the rest of the session: reads return null, writes do nothing, and the zustand store keeps
 * the keys in memory. A storage that throws synchronously is caught the same way.
 */
function guardStorage(storage: IStorage): GuardedStorage {
  let degraded = false;
  const run = async <T>(operation: keyof IStorage, call: () => Promise<T>, fallback: T): Promise<T> => {
    if (degraded) return fallback;
    try {
      return await call();
    } catch (error) {
      // Calls already in flight fail too; only the first one warns.
      if (!degraded) {
        degraded = true;
        console.warn(
          `[cofhe] FHE key storage failed on ${operation}; keeping the keys in memory for this session.`,
          error
        );
      }
      return fallback;
    }
  };
  return {
    getItem: (name) => run('getItem', () => storage.getItem(name), null),
    setItem: (name, value) => run('setItem', () => storage.setItem(name, value), undefined),
    removeItem: (name) => run('removeItem', () => storage.removeItem(name), undefined),
    status: () => (degraded ? 'memory' : 'persistent'),
  };
}

function isStoreWithPersist(store: StoreApi<KeysStore> | StoreWithPersist): store is StoreWithPersist {
  return 'persist' in store;
}
/**
 * Creates a keys storage instance using the provided storage implementation
 * @param storage - The storage implementation to use (IStorage interface), or null for non-persisted store
 * @returns A KeysStorage instance with all utility methods
 */
export function createKeysStore(storage: IStorage | null): KeysStorage {
  const guarded = storage ? guardStorage(storage) : null;
  // Conditionally create store with or without persist wrapper
  const keysStore = guarded
    ? createStoreWithPersit(guarded)
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

  const getCrs = (chainId: number | undefined, securityZone = 0) => {
    if (chainId == null || securityZone == null) return undefined;
    const stored = keysStore.getState().crs[chainId]?.[securityZone];
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

  const setCrs = (chainId: number, securityZone: number, crs: string) => {
    keysStore.setState(
      produce<KeysStore>((state: KeysStore) => {
        if (state.crs[chainId] == null) state.crs[chainId] = {};
        state.crs[chainId][securityZone] = crs;
      })
    );
  };

  const clearKeysStorage = async () => {
    if (guarded) {
      await guarded.removeItem(KEYSTORE_NAME);
    }
    // If no storage, this is a no-op
  };

  const storageStatus = () => guarded?.status() ?? 'memory';

  const rehydrateKeysStore = async () => {
    if (!isStoreWithPersist(keysStore)) return;
    if (keysStore.persist.hasHydrated()) return;
    await keysStore.persist.rehydrate();
  };

  return {
    store: keysStore,
    getFheKey,
    getCrs,
    setFheKey,
    setCrs,
    clearKeysStorage,
    rehydrateKeysStore,
    storageStatus,
  };
}

function createStoreWithPersit(storage: IStorage) {
  const result = createStore<KeysStore>()(
    persist(() => DEFAULT_KEYS_STORE, {
      // because earleir tests were written with on-init hydration skipped (due to the error suppression in zustand), returning this flag to fix test (i.e. KeyStore > Storage Utilities > should rehydrate keys store)
      skipHydration: true,
      // if onRehydrateStorage is not passed here, the errors thrown by storage layer are swallowed by zustand here: https://github.com/pmndrs/zustand/blob/39a391b6c1ff9aa89b81694d9bdb21da37dd4ac6/src/middleware/persist.ts#L321
      // Storage failures no longer reach this callback (the guard turns them into an empty read);
      // what does is a persisted value `merge` rejects, which is worth surfacing. The wrapper keeps
      // the original error as `cause`, so the chain survives into the CofheError built from it.
      onRehydrateStorage: () => (_state?, _error?) => {
        if (_error) {
          const message = _error instanceof Error ? _error.message : String(_error);
          throw new Error(`onRehydrateStorage: Error rehydrating keys store: ${message}`, { cause: _error });
        }
      },
      name: KEYSTORE_NAME,
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

        // Deep merge for crs. A `crs` persisted before it was keyed by security zone holds a
        // bare string per chain; those entries are dropped so the CRS is refetched per zone
        // rather than indexed as a string.
        const mergedCrs: KeysStore['crs'] = {};
        const allCrsChainIds = new Set([...Object.keys(current.crs), ...Object.keys(persisted.crs)]);
        for (const chainId of allCrsChainIds) {
          const persistedZones = isSecurityZoneRecord(persisted.crs[chainId]) ? persisted.crs[chainId] : {};
          const currentZones = isSecurityZoneRecord(current.crs[chainId]) ? current.crs[chainId] : {};
          mergedCrs[chainId] = { ...persistedZones, ...currentZones };
        }

        return {
          fhe: mergedFhe,
          crs: mergedCrs,
        };
      },
    })
  );
  return result;
}
