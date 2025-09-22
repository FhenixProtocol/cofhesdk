/* eslint-disable no-undef */

// Determine if we're in a browser environment
const isBrowser = typeof window !== "undefined" && !!window.indexedDB;

// Memory storage fallback
const memoryStorage: Record<string, string> = {};

// Storage interface
/* eslint-disable no-unused-vars */
export interface IStorage {
  getItem: (name: string) => Promise<any>;
  setItem: (name: string, value: any) => Promise<void>;
  removeItem: (name: string) => Promise<void>;
}
/* eslint-enable no-unused-vars */

export const getStorage = (): IStorage => {
  if (isBrowser) {
    // Browser storage using IndexedDB (loaded dynamically to avoid bundler issues)
    return {
      getItem: async (name: string) => {
        const { get } = await import("idb-keyval");
        return (await get(name)) || null;
      },
      setItem: async (name: string, value: any) => {
        const { set } = await import("idb-keyval");
        await set(name, value);
      },
      removeItem: async (name: string) => {
        const { del } = await import("idb-keyval");
        await del(name);
      },
    };
  }

  // Node.js storage using the filesystem
  return {
    getItem: async (name: string) => {
      try {
        const fs = await import("fs");
        const path = await import("path");
        const storageDir = path.join(
          // eslint-disable-next-line turbo/no-undeclared-env-vars
          process.env.HOME || process.env.USERPROFILE || ".",
          ".cofhesdk",
        );
        await fs.promises.mkdir(storageDir, { recursive: true });
        const filePath = path.join(storageDir, `${name}.json`);
        const data = await fs.promises
          .readFile(filePath, "utf8")
          .catch(() => null);
        return data ? JSON.parse(data) : null;
      } catch (e) {
        console.warn(
          "Node.js filesystem modules not available, falling back to memory storage",
        );
        return memoryStorage[name] || null;
      }
    },
    setItem: async (name: string, value: any) => {
      try {
        const fs = await import("fs");
        const path = await import("path");
        const storageDir = path.join(
          // eslint-disable-next-line turbo/no-undeclared-env-vars
          process.env.HOME || process.env.USERPROFILE || ".",
          ".cofhesdk",
        );
        await fs.promises.mkdir(storageDir, { recursive: true });
        const filePath = path.join(storageDir, `${name}.json`);
        await fs.promises.writeFile(filePath, JSON.stringify(value));
      } catch (e) {
        console.warn(
          "Node.js filesystem modules not available, falling back to memory storage",
        );
        memoryStorage[name] = JSON.stringify(value);
      }
    },
    removeItem: async (name: string) => {
      try {
        const fs = await import("fs");
        const path = await import("path");
        const storageDir = path.join(
          // eslint-disable-next-line turbo/no-undeclared-env-vars
          process.env.HOME || process.env.USERPROFILE || ".",
          ".cofhesdk",
        );
        const filePath = path.join(storageDir, `${name}.json`);
        await fs.promises.unlink(filePath).catch(() => {});
      } catch (e) {
        console.warn(
          "Node.js filesystem modules not available, falling back to memory storage",
        );
        delete memoryStorage[name];
      }
    },
  };
};