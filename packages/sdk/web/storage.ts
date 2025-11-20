import type { IStorage } from '@/core';
import { constructClient } from 'iframe-shared-storage';
//
/**
 * Creates a web storage implementation using IndexedDB
 * @returns IStorage implementation for browser environments
 */

const client = constructClient({
  iframe: {
    src: 'https://iframe-storage.vercel.app/hub.html',
    messagingOptions: {
      enableLog: 'both',
    },
  },
});

console.log('client', client);

const indexedDBKeyval = client.indexedDBKeyval;

if (!indexedDBKeyval) {
  throw new Error('IndexedDBKeyval is not available in the client');
}

let initialized = false;
export const createWebStorage = (): IStorage => {
  return {
    getItem: async (name: string) => {
      console.log('Getting item from IndexedDB:', name);
      if (!initialized) {
        // TODO: fix this ugly hack to wait for the iframe to initialize
        await new Promise((resolve) => setTimeout(resolve, 1000));
      }

      return await indexedDBKeyval.get(name);
    },
    setItem: async (name: string, value: any) => {
      console.log('Setting item in IndexedDB:', name, value);
      await indexedDBKeyval.set(name, value);
    },
    removeItem: async (name: string) => {
      console.log('Removing item from IndexedDB:', name);
      await indexedDBKeyval.del(name);
    },
  };
};
