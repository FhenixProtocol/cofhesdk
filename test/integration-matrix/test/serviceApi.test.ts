import { describe, it, inject } from 'vitest';
import { createCofheClient, createCofheConfig } from '@cofhe/sdk/node';
import { localcofheConfig } from '../src/chains/index.js';
import { runServiceApiSuite } from '../src/suites/serviceApi.js';
import type { ClientFactory } from '../src/types.js';
import { getMatrixChains } from '../src/matrix.js';

const factory: ClientFactory = {
  createConfig: createCofheConfig,
  createClient: createCofheClient,
};

// Only localcofhe runs real services at versions pinned by cofhe master. Testnets and staging may
// lag or lead, so a failure there would not point at a breaking change.
const [{ chain, chainEnabled, nodeEnabled }] = getMatrixChains(inject('matrixEnv'), inject('matrixChain'), [
  localcofheConfig,
]);

if (chainEnabled && nodeEnabled) {
  describe(`[SERVICE API] Node X ${chain.label}`, () => {
    runServiceApiSuite(chain, factory);
  });
} else {
  it.skip(`[SERVICE API] Node X ${chain.label} — Skipped`, () => {});
}
