/**
 * One Anvil node with the CoFHE mocks and the test contracts on it, for vitest globalSetup files.
 *
 * `@cofhe/integration-matrix` uses it for the Hardhat (Mock) chain. `@cofhe/react` uses it for the
 * hook tests that need a chain. Each passes its own port, so `turbo run test` can run both at once.
 */

import { spawn, execSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, resolve } from 'node:path';
import { createPublicClient, createWalletClient, http } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { deployMocks } from '@cofhe/hardhat-3-plugin';
import { createFoundryArtifactReader } from './foundryArtifactReader.js';

/** The default port. A suite that can run next to another one passes its own to `startAnvilWithMocks`. */
export const ANVIL_PORT = 8546;
export const ANVIL_CHAIN_ID = 31337;
/** Anvil's first default account. It deploys everything and is "Bob" in the tests. */
export const ANVIL_PRIVATE_KEY = '0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80' as const;

/** What the test files read back with `inject()`. Every value is '' when no Anvil was started. */
export type AnvilDeployment = {
  anvilRpc: string;
  anvilSimpleTest: string;
  /**
   * SimpleTest's creation bytecode. Only the last writer can read SimpleTest's value slot, so a
   * test file that writes while other files run deploys one of its own from this.
   */
  anvilSimpleTestBytecode: string;
  anvilSimpleStorage: string;
  anvilSimpleKeyValueStore: string;
  anvilSimpleErc20: string;
  anvilAcpValidator: string;
  anvilAcpShareRegistry: string;
};

export const NO_ANVIL: AnvilDeployment = {
  anvilRpc: '',
  anvilSimpleTest: '',
  anvilSimpleTestBytecode: '',
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

async function isRpcUp(url: string): Promise<boolean> {
  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ jsonrpc: '2.0', method: 'eth_chainId', params: [], id: 1 }),
    });
    return res.ok;
  } catch {
    return false;
  }
}

async function waitForAnvil(url: string, timeoutMs = 15_000): Promise<void> {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    if (await isRpcUp(url)) return;
    await new Promise((r) => setTimeout(r, 200));
  }
  throw new Error(`Anvil did not start within ${timeoutMs}ms`);
}

/** The @cofhe/test-setup package, where the test contracts and foundry.toml are. */
function testSetupDir(): string {
  // The package's main entry is dist/index.js. Its root is one level up.
  const require = createRequire(import.meta.url);
  return resolve(dirname(require.resolve('@cofhe/test-setup')), '..');
}

/** `forge create` from the @cofhe/test-setup package. */
function deployTestContract(target: string, rpcUrl: string): string {
  const setupDir = testSetupDir();

  const result = execSync(
    `forge create ${target} ` +
      `--rpc-url ${rpcUrl} ` +
      `--private-key ${ANVIL_PRIVATE_KEY} ` +
      `--chain ${ANVIL_CHAIN_ID} ` +
      `--broadcast`,
    { cwd: setupDir, encoding: 'utf8' }
  );

  const addressMatch = result.match(/Deployed to:\s+(0x[0-9a-fA-F]+)/);
  if (!addressMatch) throw new Error(`Failed to parse deploy address for ${target}:\n${result}`);
  return addressMatch[1];
}

/** A test contract's creation bytecode, from the artifact forge wrote when it deployed the contract. */
function readTestContractBytecode(name: string): string {
  const artifact = JSON.parse(readFileSync(resolve(testSetupDir(), 'out', `${name}.sol`, `${name}.json`), 'utf8'));
  return artifact.bytecode.object;
}

/**
 * Starts Anvil on `port`, deploys the CoFHE mocks and the test contracts, and returns the addresses.
 *
 * Every suite deploys from the same account, so two suites on one node send the same transactions
 * and one of them fails. That is why each suite has its own port, and why a node that already
 * answers on the port is an error instead of being reused.
 */
export async function startAnvilWithMocks(logPrefix = '[anvil]', port: number = ANVIL_PORT): Promise<AnvilHandle> {
  const log = (message: string) => console.log(`${logPrefix} ${message}`);
  const rpcUrl = `http://127.0.0.1:${port}`;

  if (await isRpcUp(rpcUrl)) {
    throw new Error(
      `${logPrefix} A node already answers on ${rpcUrl}. It is another test run, or an Anvil left over from one. ` +
        `Stop it (lsof -ti tcp:${port} | xargs kill) and run again.`
    );
  }

  log('Starting Anvil...');
  const anvil = spawn(
    'anvil',
    ['--port', String(port), '--chain-id', String(ANVIL_CHAIN_ID), '--code-size-limit', '100000', '--silent'],
    { stdio: 'ignore' }
  );
  anvil.on('error', (err) => {
    console.error(`${logPrefix} Anvil process error:`, err);
  });

  await waitForAnvil(rpcUrl);
  log(`Anvil running on ${rpcUrl}`);

  const account = privateKeyToAccount(ANVIL_PRIVATE_KEY);
  const publicClient = createPublicClient({ transport: http(rpcUrl) });
  const walletClient = createWalletClient({ transport: http(rpcUrl), account });
  const artifacts = createFoundryArtifactReader();

  log('Deploying mock contracts...');
  const deployedMocks = await deployMocks(
    { publicClient, walletClient, artifacts: artifacts as any },
    { gasWarning: false, mocksDeployVerbosity: 'v' }
  );

  const deploy = (name: string, target: string) => {
    log(`Deploying ${name}...`);
    const address = deployTestContract(target, rpcUrl);
    log(`${name} deployed at ${address}`);
    return address;
  };

  const deployment: AnvilDeployment = {
    anvilRpc: rpcUrl,
    anvilSimpleTest: deploy('SimpleTest', 'contracts/SimpleTest.sol:SimpleTest'),
    anvilSimpleStorage: deploy('SimpleStorage', 'contracts/SimpleStorage.sol:SimpleStorage'),
    anvilSimpleKeyValueStore: deploy('SimpleKeyValueStore', 'contracts/SimpleKeyValueStore.sol:SimpleKeyValueStore'),
    anvilSimpleErc20: deploy('SimpleERC20', 'contracts/SimpleERC20.sol:SimpleERC20'),
    anvilSimpleTestBytecode: readTestContractBytecode('SimpleTest'),
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
