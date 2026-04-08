import type { ArtifactManager } from 'hardhat/types/artifacts';
import type { PublicClient, WalletClient } from 'viem';
import { createTestClient, custom } from 'viem';
import chalk from 'chalk';
import { privateKeyToAccount } from 'viem/accounts';

import { MockTaskManagerArtifact, MockThresholdNetworkArtifact, TestBedArtifact } from '@cofhe/mock-contracts';
import {
  TASK_MANAGER_ADDRESS,
  MOCKS_ZK_VERIFIER_ADDRESS,
  MOCKS_ZK_VERIFIER_SIGNER_ADDRESS,
  MOCKS_ZK_VERIFIER_SIGNER_PRIVATE_KEY,
  MOCKS_DECRYPT_RESULT_SIGNER_PRIVATE_KEY,
  MOCKS_THRESHOLD_NETWORK_ADDRESS,
  TEST_BED_ADDRESS,
} from '@cofhe/sdk';

/**
 * Controls deploy-mocks console output.
 * - `''`   — silent, no output
 * - `'v'`  — single summary line (default)
 * - `'vv'` — full per-contract deployment logs
 */
export type LogMocksDeploy = '' | 'v' | 'vv';

/** Keyed map of deployed mock contract addresses returned by `deployMocks`. */
export type DeployedMockContracts = {
  MockTaskManager: `0x${string}`;
  MockACL: `0x${string}`;
  MockZkVerifier: `0x${string}`;
  MockThresholdNetwork: `0x${string}`;
  TestBed: `0x${string}` | undefined;
};

export type DeployMocksArgs = {
  deployTestBed?: boolean;
  gasWarning?: boolean;
  mocksDeployVerbosity?: LogMocksDeploy;
};

export type DeployContext = {
  publicClient: PublicClient;
  walletClient: WalletClient;
  artifacts: ArtifactManager;
};

let verbosity: LogMocksDeploy = 'v';

// ─── Public entrypoint ────────────────────────────────────────────────────────

/**
 * Returns true when the provider supports Hardhat-specific RPC methods (i.e.
 * it is an in-process Hardhat / EDR network, or localcofhe).
 */
async function isLocalHardhatNetwork(publicClient: PublicClient): Promise<boolean> {
  try {
    await (publicClient as any).request({ method: 'hardhat_metadata', params: [] });
    return true;
  } catch {
    return false;
  }
}

export async function deployMocks(ctx: DeployContext, options: DeployMocksArgs = {}): Promise<DeployedMockContracts> {
  const { deployTestBed = true, gasWarning = true } = options;
  verbosity = options.mocksDeployVerbosity ?? 'v';

  if (!(await isLocalHardhatNetwork(ctx.publicClient))) {
    log('v', `cofhe-hardhat-3-plugin - deploy mocks - skipped on non-hardhat network`, 0);
    return {} as DeployedMockContracts;
  }

  log('vv', chalk.bold('cofhe-hardhat-3-plugin :: deploy mocks'), 0);

  // 1. Deploy TaskManager to its fixed address
  await deployFixed(ctx.publicClient, 'MockTaskManager', TASK_MANAGER_ADDRESS, ctx.artifacts);
  logDeployment('MockTaskManager', TASK_MANAGER_ADDRESS);

  // 2. Initialize TaskManager — owner = first connected account
  const [account] = await ctx.walletClient.getAddresses();
  await ctx.walletClient.writeContract({
    address: TASK_MANAGER_ADDRESS,
    abi: MockTaskManagerArtifact.abi,
    functionName: 'initialize',
    args: [account],
    account,
    chain: null,
  });

  // 3. Configure security zones
  await ctx.walletClient.writeContract({
    address: TASK_MANAGER_ADDRESS,
    abi: MockTaskManagerArtifact.abi,
    functionName: 'setSecurityZones',
    args: [0, 1],
    account,
    chain: null,
  });

  // 4. Deploy MockACL normally so its EIP-712 constructor runs
  const aclAddress = await deployVariable(ctx, 'MockACL', []);
  logDeployment('MockACL', aclAddress);

  // 5. Link ACL into TaskManager
  await ctx.walletClient.writeContract({
    address: TASK_MANAGER_ADDRESS,
    abi: MockTaskManagerArtifact.abi,
    functionName: 'setACLContract',
    args: [aclAddress],
    account,
    chain: null,
  });
  log('vv', 'ACL address set in TaskManager', 2);

  // 6. Set ZkVerifier signer (the key is well-known and shared with the SDK)
  const verifierSigner = privateKeyToAccount(MOCKS_ZK_VERIFIER_SIGNER_PRIVATE_KEY);
  await ctx.walletClient.writeContract({
    address: TASK_MANAGER_ADDRESS,
    abi: MockTaskManagerArtifact.abi,
    functionName: 'setVerifierSigner',
    args: [verifierSigner.address],
    account,
    chain: null,
  });
  log('vv', 'Verifier signer set', 2);

  // 7. Set decrypt result signer
  const decryptSigner = privateKeyToAccount(MOCKS_DECRYPT_RESULT_SIGNER_PRIVATE_KEY);
  await ctx.walletClient.writeContract({
    address: TASK_MANAGER_ADDRESS,
    abi: MockTaskManagerArtifact.abi,
    functionName: 'setDecryptResultSigner',
    args: [decryptSigner.address],
    account,
    chain: null,
  });
  log('vv', 'Decrypt result signer set', 2);

  // 8. Fund the ZkVerifier signer account so it can send transactions.
  //    We create a testClient on-the-fly from the publicClient's transport.
  const testClient = createTestClient({
    mode: 'hardhat',
    transport: custom(ctx.publicClient.transport as any),
  });
  await testClient.setBalance({
    address: MOCKS_ZK_VERIFIER_SIGNER_ADDRESS,
    value: BigInt('10000000000000000000'), // 10 ETH
  });
  log('vv', `ZkVerifier signer (${MOCKS_ZK_VERIFIER_SIGNER_ADDRESS}) funded`, 1);

  const zkVerifierBalance = await ctx.publicClient.getBalance({ address: MOCKS_ZK_VERIFIER_SIGNER_ADDRESS });
  log('vv', `ETH balance: ${zkVerifierBalance.toString()}`, 2);

  // 9. Deploy MockZkVerifier to its fixed address
  await deployFixed(ctx.publicClient, 'MockZkVerifier', MOCKS_ZK_VERIFIER_ADDRESS, ctx.artifacts);
  logDeployment('MockZkVerifier', MOCKS_ZK_VERIFIER_ADDRESS);

  // 10. Deploy MockThresholdNetwork to its fixed address + initialize
  await deployFixed(ctx.publicClient, 'MockThresholdNetwork', MockThresholdNetworkArtifact.fixedAddress, ctx.artifacts);
  logDeployment('MockThresholdNetwork', MockThresholdNetworkArtifact.fixedAddress);
  await ctx.walletClient.writeContract({
    address: MockThresholdNetworkArtifact.fixedAddress as `0x${string}`,
    abi: MockThresholdNetworkArtifact.abi,
    functionName: 'initialize',
    args: [TASK_MANAGER_ADDRESS, aclAddress],
    account,
    chain: null,
  });

  // 11. Optionally deploy TestBed
  if (deployTestBed) {
    await deployFixed(ctx.publicClient, 'TestBed', TestBedArtifact.fixedAddress, ctx.artifacts);
    logDeployment('TestBed', TestBedArtifact.fixedAddress);
  }

  log('v', chalk.bold('cofhe-hardhat-3-plugin :: mocks deployed'), 0);

  if (gasWarning) {
    logEmpty('v');
    logWarning(
      'When using mocks, FHE operations report a higher gas price due to on-chain mocking logic. ' +
        'Deploy your contracts on a testnet to check true gas costs.\n' +
        "(Disable this warning by setting 'cofhe.gasWarning: false' in your Hardhat config)",
      0
    );
  }

  logEmpty('v');

  return {
    MockTaskManager: TASK_MANAGER_ADDRESS,
    MockACL: aclAddress,
    MockZkVerifier: MOCKS_ZK_VERIFIER_ADDRESS,
    MockThresholdNetwork: MOCKS_THRESHOLD_NETWORK_ADDRESS,
    TestBed: deployTestBed ? TEST_BED_ADDRESS : undefined,
  };
}

// ─── Deployment helpers ───────────────────────────────────────────────────────

/** Sets compiled bytecode at a fixed address via hardhat_setCode. */
async function deployFixed(
  publicClient: PublicClient,
  contractName: string,
  fixedAddress: string,
  artifactManager: ArtifactManager
): Promise<void> {
  const { deployedBytecode } = await artifactManager.readArtifact(contractName);
  await (publicClient as any).request({
    method: 'hardhat_setCode',
    params: [fixedAddress, deployedBytecode],
  });
}

/** Deploys a contract by name and returns its deployed address. */
async function deployVariable(
  ctx: DeployContext,
  contractName: string,
  constructorArgs: readonly unknown[]
): Promise<`0x${string}`> {
  const [account] = await ctx.walletClient.getAddresses();
  const { abi, bytecode } = await ctx.artifacts.readArtifact(contractName);

  const hash = await ctx.walletClient.deployContract({
    abi,
    bytecode: bytecode as `0x${string}`,
    args: constructorArgs as unknown[],
    account,
    chain: null,
  });

  const receipt = await ctx.publicClient.waitForTransactionReceipt({ hash });

  if (!receipt.contractAddress) {
    throw new Error('deployVariable: no contractAddress in receipt');
  }

  return receipt.contractAddress;
}

// ─── Logging ──────────────────────────────────────────────────────────────────

/**
 * Emit a green ✓ line at `minVerbosity` or above.
 * - `minVerbosity = 'v'`  → prints for both 'v' and 'vv'
 * - `minVerbosity = 'vv'` → prints only for 'vv'
 */
const log = (minVerbosity: 'v' | 'vv', message: string, indent = 1) => {
  if (verbosity === '') return;
  if (minVerbosity === 'vv' && verbosity !== 'vv') return;
  console.log(chalk.green(`${'  '.repeat(indent)}✓ ${message}`));
};

const logEmpty = (minVerbosity: 'v' | 'vv' = 'v') => {
  if (verbosity === '') return;
  if (minVerbosity === 'vv' && verbosity !== 'vv') return;
  console.log('');
};

const logWarning = (message: string, indent = 1) => {
  if (verbosity === '') return;
  console.log(chalk.bold(chalk.yellow(`${'  '.repeat(indent)}⚠ NOTE:`)), message);
};

const logDeployment = (contractName: string, address: string) => {
  if (verbosity !== 'vv') return;
  const paddedName = `${contractName} deployed`.padEnd(36);
  console.log(chalk.green(`  ✓ ${paddedName} ${chalk.bold(address)}`));
};
