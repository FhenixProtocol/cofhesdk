/* global indexedDB, IDBDatabase, IDBTransactionMode, IDBObjectStore, IDBRequest */
import type { IStorage } from '../core/types.js';

// Why this storage has a file of its own, and is not next to the shared hub storage in
// `storage.ts`: the proving worker imports this file, and `storage.ts` imports
// `iframe-shared-storage` for the hub. In one file, the built worker would load that library,
// which it cannot use (a worker has no iframe). Keep this file free of that import.

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
