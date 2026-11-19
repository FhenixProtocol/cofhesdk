/**
 * One Anvil node with the CoFHE mocks and the test contracts on it, for vitest globalSetup files.
 *
 * `@cofhe/integration-matrix` uses it for the Hardhat (Mock) chain. `@cofhe/react` uses it for the
 * hook tests that need a chain. Both use the same port, so they cannot run at the same time.
 */

import { spawn, execSync } from 'node:child_process';
import { createRequire } from 'node:module';
import { dirname, resolve } from 'node:path';
import { createPublicClient, createWalletClient, http } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { deployMocks } from '@cofhe/hardhat-3-plugin';
import { createFoundryArtifactReader } from './foundryArtifactReader.js';

export const ANVIL_PORT = 8546;
export const ANVIL_RPC = `http://127.0.0.1:${ANVIL_PORT}`;
export const ANVIL_CHAIN_ID = 31337;
/** Anvil's first default account. It deploys everything and is "Bob" in the tests. */
export const ANVIL_PRIVATE_KEY = '0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80' as const;

/** What the test files read back with `inject()`. Every value is '' when no Anvil was started. */
export type AnvilDeployment = {
  anvilRpc: string;
  anvilSimpleTest: string;
  /**
   * A second SimpleTest. Its value slot can be read only by the last writer, so a test that
   * writes while other files write too needs one of its own.
   */
  anvilSimpleTestPerChainDecrypt: string;
  anvilSimpleStorage: string;
  anvilSimpleKeyValueStore: string;
  anvilSimpleErc20: string;
  anvilAcpValidator: string;
  anvilAcpShareRegistry: string;
};

export const NO_ANVIL: AnvilDeployment = {
  anvilRpc: '',
  anvilSimpleTest: '',
  anvilSimpleTestPerChainDecrypt: '',
  anvilSimpleStorage: '',
  anvilSimpleKeyValueStore: '',
  anvilSimpleErc20: '',
  anvilAcpValidator: '',
  anvilAcpShareRegistry: '',
};

export type AnvilHandle = {
  deployment: AnvilDeployment;
  /** Stops the node. */
  stop: () => void;
};

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

/** `forge create` from the @cofhe/test-setup package, where the test contracts and foundry.toml are. */
function deployTestContract(target: string): string {
  // The package's main entry is dist/index.js. Its root is one level up.
  const require = createRequire(import.meta.url);
  const setupDir = resolve(dirname(require.resolve('@cofhe/test-setup')), '..');

  const result = execSync(
    `forge create ${target} ` +
      `--rpc-url ${ANVIL_RPC} ` +
      `--private-key ${ANVIL_PRIVATE_KEY} ` +
      `--chain ${ANVIL_CHAIN_ID} ` +
      `--broadcast`,
    { cwd: setupDir, encoding: 'utf8' }
  );

  const addressMatch = result.match(/Deployed to:\s+(0x[0-9a-fA-F]+)/);
  if (!addressMatch) throw new Error(`Failed to parse deploy address for ${target}:\n${result}`);
  return addressMatch[1];
}

/** Starts Anvil, deploys the CoFHE mocks and the test contracts, and returns the addresses. */
export async function startAnvilWithMocks(logPrefix = '[anvil]'): Promise<AnvilHandle> {
  const log = (message: string) => console.log(`${logPrefix} ${message}`);

  log('Starting Anvil...');
  const anvil = spawn(
    'anvil',
    ['--port', String(ANVIL_PORT), '--chain-id', String(ANVIL_CHAIN_ID), '--code-size-limit', '100000', '--silent'],
    { stdio: 'ignore' }
  );
  anvil.on('error', (err) => {
    console.error(`${logPrefix} Anvil process error:`, err);
  });

  await waitForAnvil(ANVIL_RPC);
  log(`Anvil running on ${ANVIL_RPC}`);

  const account = privateKeyToAccount(ANVIL_PRIVATE_KEY);
  const publicClient = createPublicClient({ transport: http(ANVIL_RPC) });
  const walletClient = createWalletClient({ transport: http(ANVIL_RPC), account });
  const artifacts = createFoundryArtifactReader();

  log('Deploying mock contracts...');
  const deployedMocks = await deployMocks(
    { publicClient, walletClient, artifacts: artifacts as any },
    { gasWarning: false, mocksDeployVerbosity: 'v' }
  );

  const deploy = (name: string, target: string) => {
    log(`Deploying ${name}...`);
    const address = deployTestContract(target);
    log(`${name} deployed at ${address}`);
    return address;
  };

  const deployment: AnvilDeployment = {
    anvilRpc: ANVIL_RPC,
    anvilSimpleTest: deploy('SimpleTest', 'contracts/SimpleTest.sol:SimpleTest'),
    anvilSimpleStorage: deploy('SimpleStorage', 'contracts/SimpleStorage.sol:SimpleStorage'),
    anvilSimpleKeyValueStore: deploy('SimpleKeyValueStore', 'contracts/SimpleKeyValueStore.sol:SimpleKeyValueStore'),
    anvilSimpleErc20: deploy('SimpleERC20', 'contracts/SimpleERC20.sol:SimpleERC20'),
    anvilSimpleTestPerChainDecrypt: deploy('SimpleTest (second)', 'contracts/SimpleTest.sol:SimpleTest'),
    anvilAcpValidator: deployedMocks.ACPTimestampRevoker,
    anvilAcpShareRegistry: deployedMocks.ACPShareRegistry,
  };

  return {
    deployment,
    stop: () => {
      log('Stopping Anvil...');
      anvil.kill('SIGTERM');
    },
  };
}

/**
 * The part of vitest's TestProject this package uses. Typed structurally so this package needs no
 * vitest types of its own. The consumer declares `interface ProvidedContext extends AnvilDeployment`
 * in its globalSetup file, against its own vitest copy.
 */
export type ProvideTarget = {
  provide: (key: keyof AnvilDeployment, value: string) => void;
};

/** Hands the deployment to the test files. They read it with `inject('anvilSimpleTest')` and so on. */
export function provideAnvil(project: ProvideTarget, deployment: AnvilDeployment): void {
  for (const key of Object.keys(deployment) as (keyof AnvilDeployment)[]) {
    project.provide(key, deployment[key]);
  }
}
