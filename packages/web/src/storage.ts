import type { IStorage } from '@cofhesdk/core';
import { get, set, del } from 'idb-keyval';

/**
 * Creates a web storage implementation using IndexedDB
 * @returns IStorage implementation for browser environments
 */
export const createWebStorage = (): IStorage => {
  return {
    getItem: async (name: string) => {
      return (await get(name)) || null;
    },
    setItem: async (name: string, value: any) => {
      await set(name, value);
    },
    removeItem: async (name: string) => {
      await del(name);
    },
  };
};
