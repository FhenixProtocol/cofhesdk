import type { PublicClient, WalletClient, TestClient } from 'viem';
import chalk from 'chalk';
import { privateKeyToAccount } from 'viem/accounts';

import {
  MockTaskManagerArtifact,
  MockACLArtifact,
  MockZkVerifierArtifact,
  MockThresholdNetworkArtifact,
  TestBedArtifact,
} from '@cofhe/mock-contracts';
import {
  TASK_MANAGER_ADDRESS,
  MOCKS_ZK_VERIFIER_ADDRESS,
  MOCKS_ZK_VERIFIER_SIGNER_ADDRESS,
  MOCKS_ZK_VERIFIER_SIGNER_PRIVATE_KEY,
  MOCKS_DECRYPT_RESULT_SIGNER_PRIVATE_KEY,
} from '@cofhe/sdk';
import type { EthereumProvider } from 'hardhat/types/providers';

export type DeployMocksArgs = {
  deployTestBed?: boolean;
  gasWarning?: boolean;
  silent?: boolean;
};

export type DeployContext = {
  provider: EthereumProvider;
  publicClient: PublicClient;
  walletClient: WalletClient;
  testClient: TestClient;
  networkName: string;
};

let isSilent = false;

// ─── Public entrypoint ────────────────────────────────────────────────────────

/**
 * Returns true when the provider supports Hardhat-specific RPC methods (i.e.
 * it is an in-process Hardhat / EDR network, or localcofhe).
 */
async function isLocalHardhatNetwork(
  provider: EthereumProvider,
  networkName: string,
): Promise<boolean> {
  if (networkName === 'localcofhe') return true;
  try {
    await provider.request({ method: 'hardhat_metadata', params: [] });
    return true;
  } catch {
    return false;
  }
}

export async function deployMocks(ctx: DeployContext, options: DeployMocksArgs = {}): Promise<void> {
  const { deployTestBed = true, gasWarning = true, silent = false } = options;

  if (!(await isLocalHardhatNetwork(ctx.provider, ctx.networkName))) {
    logSuccess(`cofhe-hardhat-3-plugin - deploy mocks - skipped on non-hardhat network ${ctx.networkName}`, 0);
    return;
  }

  isSilent = silent;

  logEmpty();
  logSuccess(chalk.bold('cofhe-hardhat-3-plugin :: deploy mocks'), 0);
  logEmpty();

  // 1. Deploy TaskManager to its fixed address
  await deployFixed(ctx.provider, MockTaskManagerArtifact);
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
  const aclAddress = await deployVariable(ctx, MockACLArtifact, []);
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
  logSuccess('ACL address set in TaskManager', 2);

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
  logSuccess('Verifier signer set', 2);

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
  logSuccess('Decrypt result signer set', 2);

  // 8. Fund the ZkVerifier signer account so it can send transactions
  await ctx.testClient.setBalance({
    address: MOCKS_ZK_VERIFIER_SIGNER_ADDRESS,
    value: BigInt('10000000000000000000'), // 10 ETH
  });
  logSuccess(`ZkVerifier signer (${MOCKS_ZK_VERIFIER_SIGNER_ADDRESS}) funded`, 1);

  const zkVerifierBalance = await ctx.publicClient.getBalance({
    address: MOCKS_ZK_VERIFIER_SIGNER_ADDRESS,
  });
  logSuccess(`ETH balance: ${zkVerifierBalance.toString()}`, 2);

  // 9. Deploy MockZkVerifier to its fixed address
  await deployFixed(ctx.provider, MockZkVerifierArtifact);
  logDeployment('MockZkVerifier', MOCKS_ZK_VERIFIER_ADDRESS);

  // 10. Deploy MockThresholdNetwork to its fixed address + initialize
  await deployFixed(ctx.provider, MockThresholdNetworkArtifact);
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
    logSuccess('TestBed deployment enabled', 2);
    await deployFixed(ctx.provider, TestBedArtifact);
    logDeployment('TestBed', TestBedArtifact.fixedAddress);
  }

  logEmpty();
  logSuccess(chalk.bold('cofhe-hardhat-3-plugin :: mocks deployed successfully'), 0);

  if (gasWarning) {
    logEmpty();
    logWarning(
      'When using mocks, FHE operations report a higher gas price due to on-chain mocking logic. ' +
        'Deploy your contracts on a testnet to check true gas costs.\n' +
        "(Disable this warning by setting 'cofhe.gasWarning: false' in your Hardhat config)",
      0
    );
  }

  logEmpty();
}

// ─── Deployment helpers ───────────────────────────────────────────────────────

/** Sets code at a fixed address via hardhat_setCode. */
async function deployFixed(
  provider: EthereumProvider,
  artifact: { fixedAddress: string; deployedBytecode: string }
): Promise<void> {
  await provider.request({
    method: 'hardhat_setCode',
    params: [artifact.fixedAddress, artifact.deployedBytecode],
  });
}

/** Deploys a variable-address artifact and returns the deployed address. */
async function deployVariable(
  ctx: DeployContext,
  artifact: { abi: readonly unknown[]; bytecode: string },
  constructorArgs: readonly unknown[]
): Promise<`0x${string}`> {
  const [account] = await ctx.walletClient.getAddresses();

  const hash = await ctx.walletClient.deployContract({
    abi: artifact.abi,
    bytecode: artifact.bytecode as `0x${string}`,
    args: constructorArgs,
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

const logEmpty = () => {
  if (isSilent) return;
  console.log('');
};

const logSuccess = (message: string, indent = 1) => {
  if (isSilent) return;
  console.log(chalk.green(`${'  '.repeat(indent)}✓ ${message}`));
};

const logWarning = (message: string, indent = 1) => {
  if (isSilent) return;
  console.log(chalk.bold(chalk.yellow(`${'  '.repeat(indent)}⚠ NOTE:`)), message);
};

const logDeployment = (contractName: string, address: string) => {
  if (isSilent) return;
  const paddedName = `${contractName} deployed`.padEnd(36);
  logSuccess(`${paddedName} ${chalk.bold(address)}`);
};
