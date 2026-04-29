/**
 * Vitest globalSetup: starts an Anvil node, deploys mock contracts + SimpleTest,
 * and stores deployment info for tests. Tears down the node after all tests complete.
 */

import { spawn, execSync, type ChildProcess } from 'node:child_process';
import { resolve } from 'node:path';
import type { TestProject } from 'vitest/node';
import { createPublicClient, createWalletClient, http } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { deployMocks } from '@cofhe/hardhat-3-plugin';
import { createFoundryArtifactReader } from './foundryArtifactReader.js';
import { getMatrixChains } from '../src/matrix.js';

const ANVIL_PORT = 8546;
const ANVIL_RPC = `http://127.0.0.1:${ANVIL_PORT}`;
const ANVIL_CHAIN_ID = 31337;
const ANVIL_PRIVATE_KEY = '0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80' as const;
const HARDHAT_LOG_PREFIX = '[integration-matrix][hardhat]';

let anvilProcess: ChildProcess | undefined;

async function waitForAnvil(url: string, timeoutMs = 15_000): Promise<void> {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    try {
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ jsonrpc: '2.0', method: 'eth_chainId', params: [], id: 1 }),
      });
      if (res.ok) return;
    } catch {
      // not ready yet
    }
    await new Promise((r) => setTimeout(r, 200));
  }
  throw new Error(`Anvil did not start within ${timeoutMs}ms`);
}

function deploySimpleTest(rpcUrl: string): string {
  const integrationSetupDir = resolve(import.meta.dirname, '..', '..', 'setup');

  const result = execSync(
    `forge create contracts/SimpleTest.sol:SimpleTest ` +
      `--rpc-url ${rpcUrl} ` +
      `--private-key ${ANVIL_PRIVATE_KEY} ` +
      `--chain ${ANVIL_CHAIN_ID} ` +
      `--broadcast`,
    { cwd: integrationSetupDir, encoding: 'utf8' }
  );

  const addressMatch = result.match(/Deployed to:\s+(0x[0-9a-fA-F]+)/);
  if (!addressMatch) throw new Error(`Failed to parse SimpleTest deploy address:\n${result}`);
  return addressMatch[1];
}

export async function setup(project: TestProject): Promise<void> {
  project.provide('matrixChain', process.env.MATRIX_CHAIN ?? '');
  project.provide('matrixEnv', process.env.MATRIX_ENV ?? '');

  if (!shouldStartAnvil(process.env.MATRIX_CHAIN, process.env.MATRIX_ENV)) {
    project.provide('anvilRpc', '');
    project.provide('anvilSimpleTest', '');
    console.log('[integration-matrix] Skipping Anvil setup; Hardhat is not selected in MATRIX_CHAIN.');
    await printMatrix(process.env.MATRIX_CHAIN, process.env.MATRIX_ENV);
    return;
  }

  console.log(`\n${HARDHAT_LOG_PREFIX} Starting Anvil...`);

  anvilProcess = spawn(
    'anvil',
    ['--port', String(ANVIL_PORT), '--chain-id', String(ANVIL_CHAIN_ID), '--code-size-limit', '100000', '--silent'],
    { stdio: 'ignore' }
  );

  anvilProcess.on('error', (err) => {
    console.error(`${HARDHAT_LOG_PREFIX} Anvil process error:`, err);
  });

  await waitForAnvil(ANVIL_RPC);
  console.log(`${HARDHAT_LOG_PREFIX} Anvil running on`, ANVIL_RPC);

  const account = privateKeyToAccount(ANVIL_PRIVATE_KEY);
  const publicClient = createPublicClient({ transport: http(ANVIL_RPC) });
  const walletClient = createWalletClient({ transport: http(ANVIL_RPC), account });
  const artifacts = createFoundryArtifactReader();

  console.log(`${HARDHAT_LOG_PREFIX} Deploying mock contracts...`);
  await deployMocks(
    { publicClient, walletClient, artifacts: artifacts as any },
    { deployTestBed: false, gasWarning: false, mocksDeployVerbosity: 'v' }
  );

  console.log(`${HARDHAT_LOG_PREFIX} Deploying SimpleTest...`);
  const simpleTestAddress = deploySimpleTest(ANVIL_RPC);
  console.log(`${HARDHAT_LOG_PREFIX} SimpleTest deployed at ${simpleTestAddress}`);

  project.provide('anvilRpc', ANVIL_RPC);
  project.provide('anvilSimpleTest', simpleTestAddress);

  await printMatrix(process.env.MATRIX_CHAIN, process.env.MATRIX_ENV);
}

const ALL_CHAINS = [
  { label: 'Hardhat (Mock)' },
  { label: 'Local CoFHE', optIn: true },
  { label: 'Ethereum Sepolia' },
  { label: 'Arbitrum Sepolia' },
  { label: 'Base Sepolia' },
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
  if (anvilProcess) {
    console.log(`${HARDHAT_LOG_PREFIX} Stopping Anvil...`);
    anvilProcess.kill('SIGTERM');
    anvilProcess = undefined;
  }
}

declare module 'vitest' {
  export interface ProvidedContext {
    anvilRpc: string;
    anvilSimpleTest: string;
    matrixChain: string;
    matrixEnv: string;
  }
}
