import { describe } from 'vitest';
import { createCofheClient, createCofheConfig } from '@cofhe/sdk/node';
import { enabledChains } from '../src/chains/index.js';
import { runInheritedSuite } from '../src/suites/inherited.js';
import type { ClientFactory } from '../src/types.js';

const factory: ClientFactory = {
  createConfig: createCofheConfig,
  createClient: createCofheClient,
};

console.log(
  'Enabled matrix chains:',
  enabledChains.map((c) => c.label)
);

for (const chain of enabledChains) {
  describe(`[MATRIX] Node X ${chain.label}`, () => {
    runInheritedSuite(chain, factory);
  });
}
