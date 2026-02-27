import { arbSepolia } from '@/chains';

import { describe, it, expect } from 'vitest';
import { createCofheConfig, createCofheClient } from './index.js';

describe('@cofhe/node - Config', () => {
  describe('createCofheConfig', () => {
    it('should automatically inject filesystem storage as default', () => {
      const config = createCofheConfig({
        supportedChains: [arbSepolia],
      });

      expect(config.fheKeyStorage).toBeDefined();
      expect(config.fheKeyStorage).not.toBeNull();
      expect(config.supportedChains).toEqual([arbSepolia]);
    });

    it('should allow overriding storage', async () => {
      const customStorage = {
        getItem: () => Promise.resolve(10),
        setItem: () => Promise.resolve(),
        removeItem: () => Promise.resolve(),
      };
      const config = createCofheConfig({
        supportedChains: [arbSepolia],
        fheKeyStorage: customStorage,
      });

      expect(await config.fheKeyStorage!.getItem('test')).toBe(10);
    });

    it('should allow null storage', () => {
      const config = createCofheConfig({
        supportedChains: [arbSepolia],
        fheKeyStorage: null,
      });

      expect(config.fheKeyStorage).toBeNull();
    });

    it('should preserve all other config options', () => {
      const config = createCofheConfig({
        supportedChains: [arbSepolia],
        mocks: {
          decryptDelay: 0,
        },
      });

      expect(config.supportedChains).toEqual([arbSepolia]);
      expect(config.mocks.decryptDelay).toBe(0);
      expect(config.fheKeyStorage).toBeDefined();
    });
  });

  describe('createCofheClient with config', () => {
    it('should create client with validated config', () => {
      const config = createCofheConfig({
        supportedChains: [arbSepolia],
      });

      const client = createCofheClient(config);

      expect(client).toBeDefined();
      expect(client.config).toBe(config);
      expect(client.config.fheKeyStorage).toBeDefined();
    });
  });
});
