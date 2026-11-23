/**
 * Flexible test suite — scratch pad for in-progress feature development.
 *
 * Add tests here freely while building a feature. Once the feature is stable
 * and the behaviour should be guaranteed across all chains, move the tests
 * to inherited.ts instead.
 *
 * NOTE: Must not use process.env in this file.
 */

import { it } from 'vitest';
import type { TestChainConfig, ClientFactory } from '../types.js';

export function runFlexibleSuite(_chainConfig: TestChainConfig, _factory: ClientFactory) {
  // This runs in CI next to the inherited suite. A suite with no tests fails the run, so this
  // placeholder stays until a real test is added. Replace it then.
  it.todo('scratch pad: add in-progress tests here, move them to inherited.ts when they hold on every chain');
}
