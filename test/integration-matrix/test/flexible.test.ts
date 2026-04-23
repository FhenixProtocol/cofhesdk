import { describe, it, inject } from 'vitest';
import { createCofheClient, createCofheConfig } from '@cofhe/sdk/node';
import { ALL_CHAINS } from '../src/chains/index.js';
import { runFlexibleSuite } from '../src/suites/flexible.js';
import type { ClientFactory } from '../src/types.js';
import { getMatrixChains } from '../src/matrix.js';

const factory: ClientFactory = {
  createConfig: createCofheConfig,
  createClient: createCofheClient,
};

const matrixChains = getMatrixChains(inject('matrixEnv'), inject('matrixChain'), ALL_CHAINS);

for (const { chain, chainEnabled, nodeEnabled } of matrixChains) {
  if (!chainEnabled || !nodeEnabled) {
    it.skip(`[FLEXIBLE] Node X ${chain.label} — Skipped`, () => {});
  }
}
for (const { chain, chainEnabled, nodeEnabled } of matrixChains) {
  if (chainEnabled && nodeEnabled) {
    describe(`[FLEXIBLE] Node X ${chain.label}`, () => {
      runFlexibleSuite(chain, factory);
    });
  }
}
