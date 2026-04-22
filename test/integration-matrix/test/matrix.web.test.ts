import { describe, it, inject } from 'vitest';
import { createCofheClient, createCofheConfig } from '@cofhe/sdk/web';
import { ALL_CHAINS } from '../src/chains/index.js';
import { runInheritedSuite } from '../src/suites/inherited.js';
import type { ClientFactory } from '../src/types.js';
import { getMatrixChains } from '../src/matrix.js';

const factory: ClientFactory = {
  createConfig: createCofheConfig,
  createClient: createCofheClient,
};

const matrixChains = getMatrixChains(inject('matrixEnv'), inject('matrixChain'), ALL_CHAINS);

// Two loops allows us to skip first and run tests after (better for reading output)

for (const { chain, chainEnabled, webEnabled } of matrixChains) {
  if (!chainEnabled || !webEnabled) {
    it.skip(`[MATRIX] Web X ${chain.label} — Skipped`, () => {});
  }
}
for (const { chain, chainEnabled, webEnabled } of matrixChains) {
  if (chainEnabled && webEnabled) {
    describe(`[MATRIX] Web X ${chain.label}`, () => {
      runInheritedSuite(chain, factory);
    });
  }
}
