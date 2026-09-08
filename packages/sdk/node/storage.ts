/* eslint-disable turbo/no-undeclared-env-vars */

import type { IStorage } from '@/core';

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
      const serialized = JSON.stringify(value);
      let tempPath: string | undefined;

      try {
        const storageDir = join(process.env.HOME || process.env.USERPROFILE || '.', '.cofhesdk');
        await fs.mkdir(storageDir, { recursive: true });
        const filePath = join(storageDir, `${name}.json`);
        tempPath = join(storageDir, `${name}.${process.pid}.${Date.now()}.${Math.random().toString(16).slice(2)}.tmp`);

        await fs.writeFile(tempPath, serialized);
        await fs.rename(tempPath, filePath);
      } catch (e) {
        if (tempPath) {
          await fs.unlink(tempPath).catch(() => {});
        }
        console.warn('Node.js filesystem modules not available, falling back to memory storage' + e);
        memoryStorage[name] = serialized;
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
