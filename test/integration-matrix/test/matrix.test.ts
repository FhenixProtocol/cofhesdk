import { describe, inject } from 'vitest';
import { createCofheClient, createCofheConfig } from '@cofhe/sdk/node';
import { getEnabledChains } from '../src/chains/index.js';
import { runInheritedSuite } from '../src/suites/inherited.js';
import type { ClientFactory } from '../src/types.js';

const factory: ClientFactory = {
  createConfig: createCofheConfig,
  createClient: createCofheClient,
};

const enabledChains = getEnabledChains(inject('matrixChain'));

for (const chain of enabledChains) {
  describe(`[MATRIX] Node X ${chain.label}`, () => {
    runInheritedSuite(chain, factory);
  });
}
