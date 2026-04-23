import { type CofheClient } from '@/core';
import { arbSepolia as cofheArbSepolia } from '@/chains';

import { describe, it, expect, beforeEach } from 'vitest';
import { createCofheClient, createCofheConfig } from '../index.js';

describe('@cofhe/node - Client', () => {
  let cofheClient: CofheClient;

  beforeEach(() => {
    const config = createCofheConfig({
      supportedChains: [cofheArbSepolia],
    });
    cofheClient = createCofheClient(config);
  });

  it('should automatically use filesystem storage as default', () => {
    expect(cofheClient.config.fheKeyStorage).toBeDefined();
    expect(cofheClient.config.fheKeyStorage).not.toBeNull();
  });

  it('should have the correct environment', () => {
    expect(cofheClient.config.environment).toBe('node');
  });
});
