/**
 * SSR-safe localStorage getter for Zustand's createJSONStorage.
 *
 * During Next.js SSR, `localStorage` and `indexedDB` are not available.
 * Zustand's default persist storage tries indexedDB first, causing
 * "indexedDB is not defined" errors. This getter returns localStorage
 * when available, or a no-op stub during SSR.
 *
 * Usage: createJSONStorage(() => getSSRSafeStorage())
 */

const noopStorage: Storage = {
  length: 0,
  clear: () => {},
  getItem: () => null,
  key: () => null,
  removeItem: () => {},
  setItem: () => {},
};

export const getSSRSafeStorage = (): Storage => {
  if (typeof window !== 'undefined' && window.localStorage) {
    return window.localStorage;
  }
  return noopStorage;
};
