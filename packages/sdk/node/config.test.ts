import { arbSepolia } from '@/chains';

import { describe, it, expect } from 'vitest';
import { createCofhesdkConfig, createCofhesdkClient } from './index.js';

describe('@cofhesdk/node - Config', () => {
  describe('createCofhesdkConfig', () => {
    it('should automatically inject filesystem storage as default', () => {
      const config = createCofhesdkConfig({
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
      const config = createCofhesdkConfig({
        supportedChains: [arbSepolia],
        fheKeyStorage: customStorage,
      });

      expect(await config.fheKeyStorage!.getItem('test')).toBe(10);
    });

    it('should allow null storage', () => {
      const config = createCofhesdkConfig({
        supportedChains: [arbSepolia],
        fheKeyStorage: null,
      });

      expect(config.fheKeyStorage).toBeNull();
    });

    it('should preserve all other config options', () => {
      const config = createCofhesdkConfig({
        supportedChains: [arbSepolia],
        mocks: {
          sealOutputDelay: 0,
        },
      });

      expect(config.supportedChains).toEqual([arbSepolia]);
      expect(config.mocks.sealOutputDelay).toBe(0);
      expect(config.fheKeyStorage).toBeDefined();
    });
  });

  describe('createCofhesdkClient with config', () => {
    it('should create client with validated config', () => {
      const config = createCofhesdkConfig({
        supportedChains: [arbSepolia],
      });

      const client = createCofhesdkClient(config);

      expect(client).toBeDefined();
      expect(client.config).toBe(config);
      expect(client.config.fheKeyStorage).toBeDefined();
    });
  });
});
