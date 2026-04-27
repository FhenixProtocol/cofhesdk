import { describe, it, inject } from 'vitest';
import { createCofheClient, createCofheConfig } from '@cofhe/sdk/web';
import { ALL_CHAINS } from '../src/chains/index.js';
import { runFlexibleSuite } from '../src/suites/flexible.js';
import type { ClientFactory } from '../src/types.js';
import { getMatrixChains } from '../src/matrix.js';

const factory: ClientFactory = {
  createConfig: createCofheConfig,
  createClient: createCofheClient,
};

const matrixChains = getMatrixChains(inject('matrixEnv'), inject('matrixChain'), ALL_CHAINS);

for (const { chain, chainEnabled, webEnabled } of matrixChains) {
  if (!chainEnabled || !webEnabled) {
    it.skip(`[FLEXIBLE] Web X ${chain.label} — Skipped`, () => {});
  }
}
for (const { chain, chainEnabled, webEnabled } of matrixChains) {
  if (chainEnabled && webEnabled) {
    describe(`[FLEXIBLE] Web X ${chain.label}`, () => {
      runFlexibleSuite(chain, factory);
    });
  }
}
