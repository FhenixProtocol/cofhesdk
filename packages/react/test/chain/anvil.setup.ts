/**
 * vitest globalSetup for the `chain` project. Starts an Anvil with the CoFHE mocks and the test
 * contracts, and hands the addresses to the test files through `inject()`.
 */

import type { TestProject } from 'vitest/node';
import { startAnvilWithMocks, provideAnvil, type AnvilDeployment, type AnvilHandle } from '@cofhe/test-anvil';

// What inject() returns in the test files.
declare module 'vitest' {
  export interface ProvidedContext extends AnvilDeployment {}
}

let anvil: AnvilHandle | undefined;

export async function setup(project: TestProject): Promise<void> {
  anvil = await startAnvilWithMocks('[react][anvil]');
  provideAnvil(project, anvil.deployment);
}

export async function teardown(): Promise<void> {
  anvil?.stop();
  anvil = undefined;
}
