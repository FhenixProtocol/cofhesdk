import { describe, it, expect } from 'vitest';
import { createCofhesdkConfig } from './index.js';
import { arbSepolia as cofhesdkArbSepolia } from '@/chains';

describe('@cofhesdk/web - Worker Config Tests (Node.js)', () => {
  describe('createCofhesdkConfig', () => {
    it('should default useWorkers to true', () => {
      const config = createCofhesdkConfig({
        supportedChains: [cofhesdkArbSepolia],
      });

      expect(config.useWorkers).toBe(true);
    });

    it('should allow setting useWorkers to false', () => {
      const config = createCofhesdkConfig({
        supportedChains: [cofhesdkArbSepolia],
        useWorkers: false,
      });

      expect(config.useWorkers).toBe(false);
    });

    it('should allow setting useWorkers to true explicitly', () => {
      const config = createCofhesdkConfig({
        supportedChains: [cofhesdkArbSepolia],
        useWorkers: true,
      });

      expect(config.useWorkers).toBe(true);
    });

    it('should include useWorkers in config object', () => {
      const config = createCofhesdkConfig({
        supportedChains: [cofhesdkArbSepolia],
        useWorkers: false,
      });

      expect(config).toHaveProperty('useWorkers');
      expect(typeof config.useWorkers).toBe('boolean');
    });
  });

  describe('Config immutability', () => {
    it('should not mutate original config object', () => {
      const originalConfig = {
        supportedChains: [cofhesdkArbSepolia],
        useWorkers: true,
      };

      const config = createCofhesdkConfig(originalConfig);

      // Modify the returned config
      (config as any).useWorkers = false;

      // Original should remain unchanged
      expect(originalConfig.useWorkers).toBe(true);
    });
  });
});

