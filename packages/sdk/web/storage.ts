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
