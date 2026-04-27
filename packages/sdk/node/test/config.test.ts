import { arbSepolia } from '@/chains';

import { describe, it, expect } from 'vitest';
import { createCofheConfig } from '../index.js';

describe('@cofhe/node - Config', () => {
  it('should automatically inject filesystem storage as default', () => {
    const config = createCofheConfig({
      supportedChains: [arbSepolia],
    });

    expect(config.fheKeyStorage).toBeDefined();
    expect(config.fheKeyStorage).not.toBeNull();
    expect(config.supportedChains).toEqual([arbSepolia]);
  });
});
