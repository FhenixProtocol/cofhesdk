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

// Not the default 8546: the integration matrix uses that one, and `turbo run test` runs both suites
// at once. The test files read the URL with inject('anvilRpc').
const REACT_ANVIL_PORT = 8547;

let anvil: AnvilHandle | undefined;

export async function setup(project: TestProject): Promise<void> {
  anvil = await startAnvilWithMocks('[react][anvil]', REACT_ANVIL_PORT);
  provideAnvil(project, anvil.deployment);
}

export async function teardown(): Promise<void> {
  anvil?.stop();
  anvil = undefined;
}
