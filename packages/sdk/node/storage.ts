/* eslint-disable turbo/no-undeclared-env-vars */

import type { IStorage } from '@/core';

import { promises as fs } from 'fs';
import { join } from 'path';

// Memory storage fallback
const memoryStorage: Record<string, unknown> = {};

const getStorageDir = () => join(process.env.HOME || process.env.USERPROFILE || '.', '.cofhesdk');

/**
 * Stored data can include sealing private keys, so the directory and files must
 * be private to the current user. `mode` only applies on creation, so chmod
 * also tightens directories/files created by earlier SDK versions.
 */
const ensureStorageDir = async (storageDir: string) => {
  await fs.mkdir(storageDir, { recursive: true, mode: 0o700 });
  await fs.chmod(storageDir, 0o700).catch(() => {});
};

/**
 * Creates a node storage implementation using the filesystem
 * @returns IStorage implementation for Node.js environments
 */
export const createNodeStorage = (): IStorage => {
  return {
    getItem: async (name: string) => {
      try {
        const storageDir = getStorageDir();
        await ensureStorageDir(storageDir);
        const filePath = join(storageDir, `${name}.json`);
        const data = await fs.readFile(filePath, 'utf8').catch(() => null);
        return data ? JSON.parse(data) : null;
      } catch (e) {
        console.warn('Node.js filesystem modules not available, falling back to memory storage' + e);
        return memoryStorage[name] || null;
      }
    },
    setItem: async (name: string, value: any) => {
      try {
        const storageDir = getStorageDir();
        await ensureStorageDir(storageDir);
        const filePath = join(storageDir, `${name}.json`);
        await fs.writeFile(filePath, JSON.stringify(value), { mode: 0o600 });
        await fs.chmod(filePath, 0o600).catch(() => {});
      } catch (e) {
        console.warn('Node.js filesystem modules not available, falling back to memory storage' + e);
        memoryStorage[name] = value;
      }
    },
    removeItem: async (name: string) => {
      try {
        const filePath = join(getStorageDir(), `${name}.json`);
        await fs.unlink(filePath).catch(() => {});
      } catch (e) {
        console.warn('Node.js filesystem modules not available, falling back to memory storage' + e);
        delete memoryStorage[name];
      }
    },
  };
};
