/**
 * Flexible test suite — scratch pad for in-progress feature development.
 *
 * Add tests here freely while building a feature. Once the feature is stable
 * and the behaviour should be guaranteed across all chains, move the tests
 * to inherited.ts instead.
 *
 * NOTE: Must not use process.env in this file.
 */

import { it, beforeAll, afterAll } from 'vitest';
import type { TestChainConfig, ClientFactory, TestContext } from '../types.js';

export function runFlexibleSuite(chainConfig: TestChainConfig, factory: ClientFactory) {
  let ctx: TestContext;

  beforeAll(async () => {
    ctx = await chainConfig.setup(factory);
  }, 60_000);

  afterAll(async () => {
    await chainConfig.teardown?.();
  });

  it.todo('add flexible tests here');
}
