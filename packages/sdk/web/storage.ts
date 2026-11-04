/* global indexedDB, IDBDatabase, IDBTransactionMode, IDBObjectStore, IDBRequest */
import type { IStorage } from '@/core';
import { constructClient } from 'iframe-shared-storage';
import { hasDOM } from './const';

/**
 * The shared key storage: IndexedDB inside the `iframe-shared-storage` hub, reached through a
 * cross-origin iframe, so every Fhenix origin sees the same keys. The client throws when the
 * iframe is not ready within 30 s or a call times out.
 */
const createHubStorage = (opts = { enableLog: false }): IStorage => {
  const client = constructClient({
    iframe: {
      src: 'https://iframe-shared-storage.vercel.app/hub.html',
      messagingOptions: {
        enableLog: opts.enableLog ? 'both' : undefined,
      },

      iframeReadyTimeoutMs: 30_000, // if the iframe is not initied during this interval AND a reuqest is made, such request will throw an error
      methodCallTimeoutMs: 10_000, // if a method call is not answered during this interval, the call will throw an error
      methodCallRetries: 3, // number of retries for a method call if it times out
    },
  });

  const indexedDBKeyval = client.indexedDBKeyval;
  return {
    getItem: async (name: string) => {
      // IndexedDBKeyval returns undefined if not found, but we want null (a json-deserialized value is expected)
      return (await indexedDBKeyval.get(name)) ?? null;
    },
    setItem: async (name: string, value: any) => {
      await indexedDBKeyval.set(name, value);
    },
    removeItem: async (name: string) => {
      await indexedDBKeyval.del(name);
    },
  };
};

const LOCAL_DB_NAME = 'cofhesdk';
const LOCAL_STORE_NAME = 'keyval';

/**
 * Key storage in the page's own IndexedDB. No iframe, no sharing across origins. Holds the CRS
 * (about 8 MB), which localStorage cannot. Throws from each call when IndexedDB is not available.
 */
export const createIndexedDbStorage = (dbName = LOCAL_DB_NAME, storeName = LOCAL_STORE_NAME): IStorage => {
  let db: Promise<IDBDatabase> | undefined;

  const open = (): Promise<IDBDatabase> => {
    if (db) return db;
    db = new Promise((resolve, reject) => {
      if (typeof indexedDB === 'undefined') {
        reject(new Error('IndexedDB is not available'));
        return;
      }
      const request = indexedDB.open(dbName, 1);
      request.onupgradeneeded = () => {
        if (!request.result.objectStoreNames.contains(storeName)) request.result.createObjectStore(storeName);
      };
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error ?? new Error(`Cannot open IndexedDB ${dbName}`));
      request.onblocked = () => reject(new Error(`IndexedDB ${dbName} is blocked`));
    });
    // Do not keep a failed open: the next call retries.
    db.catch(() => {
      db = undefined;
    });
    return db;
  };

  const run = <T>(mode: IDBTransactionMode, op: (store: IDBObjectStore) => IDBRequest<T>): Promise<T> =>
    open().then(
      (database) =>
        new Promise<T>((resolve, reject) => {
          const transaction = database.transaction(storeName, mode);
          const request = op(transaction.objectStore(storeName));
          transaction.oncomplete = () => resolve(request.result);
          transaction.onerror = () => reject(transaction.error ?? new Error('IndexedDB transaction failed'));
          transaction.onabort = () => reject(transaction.error ?? new Error('IndexedDB transaction aborted'));
        })
    );

  return {
    getItem: async (name: string) => (await run('readonly', (store) => store.get(name))) ?? null,
    setItem: async (name: string, value: any) => {
      await run('readwrite', (store) => store.put(value, name));
    },
    removeItem: async (name: string) => {
      await run('readwrite', (store) => store.delete(name));
    },
  };
};

export type StorageOperation = keyof IStorage;

/** Called once, when a storage switches to its fallback: which call failed, and with what. */
export type OnStorageFallback = (info: { operation: StorageOperation; error: unknown }) => void;

/**
 * A storage that switches to `fallback` on the first error from `primary`, for the rest of the
 * session. The failed call is retried on the fallback. Logs one warning when it switches, and
 * calls `onFallback` if given.
 */
export const withFallback = (
  primary: IStorage,
  fallback: IStorage,
  warning: string,
  onFallback?: OnStorageFallback
): IStorage => {
  let current = primary;
  const run = async <T>(operation: StorageOperation, call: (storage: IStorage) => Promise<T>): Promise<T> => {
    if (current === fallback) return call(fallback);
    try {
      return await call(primary);
    } catch (error) {
      current = fallback;
      console.warn(warning, error);
      onFallback?.({ operation, error });
      return call(fallback);
    }
  };
  return {
    getItem: (name) => run('getItem', (storage) => storage.getItem(name)),
    setItem: (name, value) => run('setItem', (storage) => storage.setItem(name, value)),
    removeItem: (name) => run('removeItem', (storage) => storage.removeItem(name)),
  };
};

/**
 * Creates the default web key storage: the shared hub, and the page's own IndexedDB when the hub
 * fails (iframe blocked, hub unreachable). Keys then persist for this origin only. If that fails
 * too, the keys store keeps the keys in memory for the session.
 * Must only be called in a browser environment (requires `document` for iframe injection).
 * @returns IStorage implementation for browser environments
 */
export const createWebStorage = (opts: { enableLog?: boolean; onFallback?: OnStorageFallback } = {}): IStorage => {
  if (!hasDOM) throw new Error('createWebStorage can only be used in a browser environment');
  return withFallback(
    createHubStorage({ enableLog: opts.enableLog ?? false }),
    createIndexedDbStorage(),
    "[cofhe] The shared key storage failed; using this page's own IndexedDB for the session.",
    opts.onFallback
  );
};

export function createSsrStorage(): IStorage {
  // TODO: consider doing something like wagmi's cookies storage for SSR - this in-memory storage will not persist across requests, but it also won't throw errors if accessed in SSR (e.g. during getServerSideProps in Next.js)
  // https://wagmi.sh/react/guides/ssr#_1-set-up-cookie-storage
  console.warn('using no-op server-side SSR storage');
  return {
    getItem: async () => null,
    setItem: async () => {},
    removeItem: async () => {},
  };
}
