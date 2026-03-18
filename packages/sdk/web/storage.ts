import type { IStorage } from '@/core';
import { constructClient } from 'iframe-shared-storage';
/**
 * Creates a web storage implementation using IndexedDB.
 * Must only be called in a browser environment (requires `document` for iframe injection).
 * Returns null during SSR to allow safe server-side config creation.
 * @returns IStorage implementation for browser environments, or null if not in a browser
 */
export const createWebStorage = (): IStorage | null => {
  // SSR guard: iframe-shared-storage requires document to inject an iframe.
  // During Next.js SSR, document is undefined — return null to skip storage.
  // Note: 'document' is not in this package's TS lib, so we access via globalThis.
  if (typeof (globalThis as unknown as { document?: unknown }).document === 'undefined') return null;

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
