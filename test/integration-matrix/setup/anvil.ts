/**
 * Vitest globalSetup. Tells the test files which chains and environments are selected, and starts
 * the shared Anvil when the Hardhat (Mock) chain is among them. The node itself, the mocks and the
 * test contracts come from @cofhe/test-anvil.
 */

import type { TestProject } from 'vitest/node';
import { startAnvilWithMocks, provideAnvil, NO_ANVIL, type AnvilDeployment, type AnvilHandle } from '@cofhe/test-anvil';
import { getMatrixChains } from '../src/matrix.js';

let anvil: AnvilHandle | undefined;

export async function setup(project: TestProject): Promise<void> {
  project.provide('matrixChain', process.env.MATRIX_CHAIN ?? '');
  project.provide('matrixEnv', process.env.MATRIX_ENV ?? '');

  if (!shouldStartAnvil(process.env.MATRIX_CHAIN, process.env.MATRIX_ENV)) {
    provideAnvil(project, NO_ANVIL);
    console.log('[integration-matrix] Skipping Anvil setup; Hardhat is not selected in MATRIX_CHAIN.');
    await printMatrix(process.env.MATRIX_CHAIN, process.env.MATRIX_ENV);
    return;
  }

  anvil = await startAnvilWithMocks('[integration-matrix][hardhat]');
  provideAnvil(project, anvil.deployment);

  await printMatrix(process.env.MATRIX_CHAIN, process.env.MATRIX_ENV);
}

const ALL_CHAINS = [
  { label: 'Hardhat (Mock)' },
  { label: 'Local CoFHE', optIn: true },
  { label: 'Ethereum Sepolia' },
  { label: 'Arbitrum Sepolia' },
  { label: 'Base Sepolia' },
  { label: 'CoFHE Staging', optIn: true },
];

function shouldStartAnvil(matrixChain?: string, matrixEnv?: string): boolean {
  const matrix = getMatrixChains(matrixEnv ?? '', matrixChain ?? '', ALL_CHAINS);
  return matrix.some(({ chain, chainEnabled }) => chainEnabled && chain.label === 'Hardhat (Mock)');
}

async function printMatrix(matrixChain?: string, matrixEnv?: string): Promise<void> {
  const matrix = getMatrixChains(matrixEnv ?? '', matrixChain ?? '', ALL_CHAINS);

  const pad = (s: string, w: number) => s + ' '.repeat(Math.max(0, w - s.length));
  const colWidths = ALL_CHAINS.map((c) => Math.max(c.label.length, 3));
  const envCol = 6;

  let header = pad('', envCol) + '| ';
  let sep = '-'.repeat(envCol) + '|';
  for (let i = 0; i < ALL_CHAINS.length; i++) {
    header += pad(ALL_CHAINS[i].label, colWidths[i]) + ' | ';
    sep += '-'.repeat(colWidths[i] + 2) + '|';
  }

  console.log('\n[integration-matrix] Test matrix:');
  console.log(header);
  console.log(sep);

  for (const env of ['Node', 'Web'] as const) {
    const key = env === 'Node' ? 'nodeEnabled' : 'webEnabled';
    let row = pad(env, envCol) + '| ';
    for (let i = 0; i < matrix.length; i++) {
      const active = matrix[i].chainEnabled && matrix[i][key];
      const mark = active ? '\x1b[1;32m✓\x1b[0m' : '\x1b[1;31mx\x1b[0m';

      row += mark + ' '.repeat(Math.max(0, colWidths[i] - 1)) + ' | ';
    }
    console.log(row);
  }
  console.log('');
}

export async function teardown(): Promise<void> {
  anvil?.stop();
  anvil = undefined;
}

// What inject() returns in the test files: the Anvil deployment plus the matrix selection.
declare module 'vitest' {
  export interface ProvidedContext extends AnvilDeployment {
    matrixChain: string;
    matrixEnv: string;
  }
}
