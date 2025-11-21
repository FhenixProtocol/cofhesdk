import type { IStorage } from '@/core';
import { constructClient } from 'iframe-shared-storage';
/**
 * Creates a web storage implementation using IndexedDB
 * @returns IStorage implementation for browser environments
 */

export const createWebStorage = (): IStorage => {
  const client = constructClient({
    iframe: {
      src: 'https://iframe-shared-storage.vercel.app/hub.html',
      messagingOptions: {
        enableLog: 'both',
      },
      iframeReadyTimeoutMs: 1000, // if the iframe is not initied during this interval AND a reuqest is made, such request will throw an error
    },
  });

  const indexedDBKeyval = client.indexedDBKeyval;

  if (!indexedDBKeyval) {
    throw new Error('IndexedDBKeyval is not available in the client');
  }
  return {
    getItem: async (name: string) => {
      try {
        return await indexedDBKeyval.get(name);
      } catch (e) {
        // TODO: outer context seems to swallow errors. Need sorting out
        console.error('Error getting item from storage', e);
        throw e;
      }
    },
    setItem: async (name: string, value: any) => {
      try {
        await indexedDBKeyval.set(name, value);
      } catch (e) {
        console.error('Error setting item in storage', e);
        throw e;
      }
    },
    removeItem: async (name: string) => {
      try {
        await indexedDBKeyval.del(name);
      } catch (e) {
        console.error('Error removing item from storage', e);
        throw e;
      }
    },
  };
};
