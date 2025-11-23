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
        // enableLog: 'both',
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
        return await indexedDBKeyval.get(name);
    },
    setItem: async (name: string, value: any) => {
        await indexedDBKeyval.set(name, value);
    },
    removeItem: async (name: string) => {
        await indexedDBKeyval.del(name);
    },
  };
};
