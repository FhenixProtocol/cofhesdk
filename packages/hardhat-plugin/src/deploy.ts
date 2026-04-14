import { type HardhatRuntimeEnvironment } from 'hardhat/types';
import chalk from 'chalk';
import { Contract, Wallet } from 'ethers';

import {
  MockTaskManagerArtifact,
  MockACLArtifact,
  MockZkVerifierArtifact,
  MockThresholdNetworkArtifact,
  TestBedArtifact,
} from '@cofhe/mock-contracts';

import {
  TASK_MANAGER_ADDRESS,
  MOCKS_ZK_VERIFIER_SIGNER_ADDRESS,
  MOCKS_DECRYPT_RESULT_SIGNER_PRIVATE_KEY,
  MOCKS_ZK_VERIFIER_SIGNER_PRIVATE_KEY,
} from '@cofhe/sdk';
import { deployMockContractFromArtifact } from './utils';

// Deployment

/**
 * Controls deploy-mocks console output.
 * - `''`   — silent, no output
 * - `'v'`  — single summary line (default)
 * - `'vv'` — full per-contract deployment logs
 */
export type LogMocksDeploy = '' | 'v' | 'vv';

export type DeployMocksArgs = {
  deployTestBed?: boolean;
  gasWarning?: boolean;
  mocksDeployVerbosity?: LogMocksDeploy;
};

export const deployMocks = async (
  hre: HardhatRuntimeEnvironment,
  options: DeployMocksArgs = {
    deployTestBed: true,
    gasWarning: true,
    mocksDeployVerbosity: 'v',
  }
) => {
  verbosity = options.mocksDeployVerbosity ?? 'v';

  // Check if network is Hardhat, if not log skip message and return
  const isHardhat = await getIsHardhat(hre);
  if (!isHardhat) {
    log('v', `cofhe-hardhat-plugin - deploy mocks - skipped on non-hardhat network ${hre.network.name}`, 0);
    return;
  }

  // Compile mock contracts before deploying so that hre.artifacts.readArtifact()
  // resolves correctly and Hardhat can decode reverts against these contracts.
  // The subtask override in index.ts adds the mock-contracts source files to the
  // compilation pipeline, so they are compiled alongside the project's own contracts.
  // Calling compile here is safe: Hardhat caches results, so a second compile
  // triggered by TASK_TEST's runSuper() will be a fast no-op.
  await hre.run('compile', { quiet: true });

  log('vv', chalk.bold('cofhe-hardhat-plugin :: deploy mocks'), 0);

  // Deploy mock contracts
  const taskManager = await deployMockTaskManager(hre);
  logDeployment('MockTaskManager', await taskManager.getAddress());

  const acl = await deployMockACL(hre);
  logDeployment('MockACL', await acl.getAddress());

  await linkTaskManagerAndACL(taskManager, acl);
  log('vv', 'ACL address set in TaskManager', 2);

  await setVerifierSigner(taskManager);
  log('vv', 'Verifier signer set', 2);

  await setDecryptResultSigner(taskManager);
  log('vv', 'Decrypt result signer set', 2);

  await fundZkVerifierSigner(hre);
  log('vv', `ZkVerifier signer (${MOCKS_ZK_VERIFIER_SIGNER_ADDRESS}) funded`, 1);

  const zkVerifierSignerBalance = await getZkVerifierSignerBalance(hre);
  log('vv', `ETH balance: ${zkVerifierSignerBalance.toString()}`, 2);

  const zkVerifier = await deployMockZkVerifier(hre);
  logDeployment('MockZkVerifier', await zkVerifier.getAddress());

  const thresholdNetwork = await deployMockThresholdNetwork(hre, acl);
  logDeployment('MockThresholdNetwork', await thresholdNetwork.getAddress());

  if (options.deployTestBed) {
    const testBed = await deployTestBedContract(hre);
    logDeployment('TestBed', await testBed.getAddress());
  }

  log('v', chalk.bold('cofhe-hardhat-plugin :: mocks deployed'), 0);

  if (options.gasWarning) {
    logEmpty('v');
    logWarning(
      "When using mocks, FHE operations (eg FHE.add / FHE.mul) report a higher gas price due to additional on-chain mocking logic. Deploy your contracts on a testnet chain to check the true gas costs.\n(Disable this warning by setting 'cofhe.gasWarning: false' in your hardhat config)",
      0
    );
  }

  logEmpty('v');
};

// Network

const getIsHardhat = async (hre: HardhatRuntimeEnvironment) => {
  return hre.network.name === 'hardhat';
};

const deployMockTaskManager = async (hre: HardhatRuntimeEnvironment) => {
  const [signer] = await hre.ethers.getSigners();

  // Deploy MockTaskManager
  const taskManager = await deployMockContractFromArtifact(hre, MockTaskManagerArtifact);

  // Initialize MockTaskManager
  const initTx = await taskManager.initialize(signer.address);
  await initTx.wait();

  // Check if MockTaskManager exists
  const tmExists = await taskManager.exists();
  if (!tmExists) {
    throw new Error('MockTaskManager does not exist');
  }

  return taskManager;
};

const deployMockACL = async (hre: HardhatRuntimeEnvironment): Promise<Contract> => {
  // Deploy MockACL (uses ethers to deploy to ensure constructor called and EIP712 domain set)
  const acl = await deployMockContractFromArtifact(hre, MockACLArtifact);

  // Check if ACL exists
  const exists = await acl.exists();
  if (!exists) {
    throw new Error('MockACL does not exist');
  }

  return acl;
};

const fundZkVerifierSigner = async (hre: HardhatRuntimeEnvironment) => {
  const zkVerifierSigner = await hre.ethers.getSigner(MOCKS_ZK_VERIFIER_SIGNER_ADDRESS);
  await hre.network.provider.send('hardhat_setBalance', [
    zkVerifierSigner.address,
    '0x' + hre.ethers.parseEther('10').toString(16),
  ]);
};

const getZkVerifierSignerBalance = async (hre: HardhatRuntimeEnvironment) => {
  return hre.ethers.provider.getBalance(MOCKS_ZK_VERIFIER_SIGNER_ADDRESS);
};

const linkTaskManagerAndACL = async (taskManager: Contract, acl: Contract) => {
  const aclAddress = await acl.getAddress();
  const linkAclTx = await taskManager.setACLContract(aclAddress);
  await linkAclTx.wait();
};

const setVerifierSigner = async (taskManager: Contract) => {
  const signer = new Wallet(MOCKS_ZK_VERIFIER_SIGNER_PRIVATE_KEY);
  const setSignerTx = await taskManager.setVerifierSigner(signer.address);
  await setSignerTx.wait();
};

const setDecryptResultSigner = async (taskManager: Contract) => {
  const signer = new Wallet(MOCKS_DECRYPT_RESULT_SIGNER_PRIVATE_KEY);
  const setSignerTx = await taskManager.setDecryptResultSigner(signer.address);
  await setSignerTx.wait();
};

const deployMockZkVerifier = async (hre: HardhatRuntimeEnvironment) => {
  const zkVerifier = await deployMockContractFromArtifact(hre, MockZkVerifierArtifact);

  const zkVerifierExists = await zkVerifier.exists();
  if (!zkVerifierExists) {
    throw new Error('MockZkVerifier does not exist');
  }

  return zkVerifier;
};

const deployMockThresholdNetwork = async (hre: HardhatRuntimeEnvironment, acl: Contract) => {
  const thresholdNetwork = await deployMockContractFromArtifact(hre, MockThresholdNetworkArtifact);

  // Initialize MockThresholdNetwork
  const initTx = await thresholdNetwork.initialize(TASK_MANAGER_ADDRESS, await acl.getAddress());
  await initTx.wait();

  // Check if MockThresholdNetwork exists
  const exists = await thresholdNetwork.exists();
  if (!exists) {
    throw new Error('MockThresholdNetwork does not exist');
  }

  return thresholdNetwork;
};

const deployTestBedContract = async (hre: HardhatRuntimeEnvironment) => {
  return deployMockContractFromArtifact(hre, TestBedArtifact);
};

// Logging

let verbosity: LogMocksDeploy = 'v';

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
