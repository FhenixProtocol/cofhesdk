/* eslint-disable turbo/no-undeclared-env-vars */

import type { IStorage } from '@cofhesdk/core';
import { promises as fs } from 'fs';
import { join } from 'path';

// Memory storage fallback
const memoryStorage: Record<string, string> = {};

/**
 * Creates a node storage implementation using the filesystem
 * @returns IStorage implementation for Node.js environments
 */
export const createNodeStorage = (): IStorage => {
  return {
    getItem: async (name: string) => {
      try {
        const storageDir = join(process.env.HOME || process.env.USERPROFILE || '.', '.cofhesdk');
        await fs.mkdir(storageDir, { recursive: true });
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
        const storageDir = join(process.env.HOME || process.env.USERPROFILE || '.', '.cofhesdk');
        await fs.mkdir(storageDir, { recursive: true });
        const filePath = join(storageDir, `${name}.json`);
        await fs.writeFile(filePath, JSON.stringify(value));
      } catch (e) {
        console.warn('Node.js filesystem modules not available, falling back to memory storage' + e);
        memoryStorage[name] = JSON.stringify(value);
      }
    },
    removeItem: async (name: string) => {
      try {
        const storageDir = join(process.env.HOME || process.env.USERPROFILE || '.', '.cofhesdk');
        const filePath = join(storageDir, `${name}.json`);
        await fs.unlink(filePath).catch(() => {});
      } catch (e) {
        console.warn('Node.js filesystem modules not available, falling back to memory storage' + e);
        delete memoryStorage[name];
      }
    },
  };
};
