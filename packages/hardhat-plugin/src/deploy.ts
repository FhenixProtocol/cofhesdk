import { type HardhatRuntimeEnvironment } from 'hardhat/types';
import chalk from 'chalk';
import { Contract } from 'ethers';

import {
  MockTaskManagerArtifact,
  MockACLArtifact,
  MockZkVerifierArtifact,
  MockQueryDecrypterArtifact,
  TestBedArtifact,
} from '@cofhe/mock-contracts';

import { TASK_MANAGER_ADDRESS, MOCKS_ZK_VERIFIER_SIGNER_ADDRESS } from '@cofhe/sdk';
import { hardhatDeployFromArtifact, ethersDeployFromArtifact } from './utils';

// Deployment

export type DeployMocksArgs = {
  deployTestBed?: boolean;
  gasWarning?: boolean;
  silent?: boolean;
};

export const deployMocks = async (
  hre: HardhatRuntimeEnvironment,
  options: DeployMocksArgs = {
    deployTestBed: true,
    gasWarning: true,
    silent: false,
  }
) => {
  // Check if network is Hardhat, if not log skip message and return
  const isHardhat = await getIsHardhat(hre);
  if (!isHardhat) {
    logSuccess(`cofhe-hardhat-plugin - deploy mocks - skipped on non-hardhat network ${hre.network.name}`, 0);
    return;
  }

  isSilent = options.silent ?? false;

  // Log start message
  logEmpty();
  logSuccess(chalk.bold('cofhe-hardhat-plugin :: deploy mocks'), 0);
  logEmpty();

  // Deploy mock contracts
  const taskManager = await deployMockTaskManager(hre);
  logDeployment('MockTaskManager', await taskManager.getAddress());

  const acl = await deployMockACL(hre);
  logDeployment('MockACL', await acl.getAddress());

  await linkTaskManagerAndACL(taskManager, acl);
  logSuccess('ACL address set in TaskManager', 2);

  await fundZkVerifierSigner(hre);
  logSuccess(`ZkVerifier signer (${MOCKS_ZK_VERIFIER_SIGNER_ADDRESS}) funded`, 1);

  const zkVerifierSignerBalance = await getZkVerifierSignerBalance(hre);
  logSuccess(`ETH balance: ${zkVerifierSignerBalance.toString()}`, 2);

  const zkVerifier = await deployMockZkVerifier(hre);
  logDeployment('MockZkVerifier', await zkVerifier.getAddress());

  const queryDecrypter = await deployMockQueryDecrypter(hre, acl);
  logDeployment('MockQueryDecrypter', await queryDecrypter.getAddress());

  if (options.deployTestBed) {
    logSuccess('TestBed deployment enabled', 2);
    const testBed = await deployTestBedContract(hre);
    logDeployment('TestBed', await testBed.getAddress());
  }

  // Log success message
  logEmpty();
  logSuccess(chalk.bold('cofhe-hardhat-plugin :: mocks deployed successfully'), 0);

  // Log warning about mocks increased gas costs
  if (options.gasWarning) {
    logEmpty();
    logWarning(
      "When using mocks, FHE operations (eg FHE.add / FHE.mul) report a higher gas price due to additional on-chain mocking logic. Deploy your contracts on a testnet chain to check the true gas costs.\n(Disable this warning by setting '@cofhe/sdk.gasWarning' to false in your hardhat config",
      0
    );
  }

  logEmpty();
};

// Network

const getIsHardhat = async (hre: HardhatRuntimeEnvironment) => {
  return hre.network.name === 'hardhat';
};

const deployMockTaskManager = async (hre: HardhatRuntimeEnvironment) => {
  const [signer] = await hre.ethers.getSigners();

  // Deploy MockTaskManager
  const taskManager = await hardhatDeployFromArtifact(hre, MockTaskManagerArtifact);

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
  const acl = await ethersDeployFromArtifact(hre, MockACLArtifact);

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

const deployMockZkVerifier = async (hre: HardhatRuntimeEnvironment) => {
  const zkVerifier = await hardhatDeployFromArtifact(hre, MockZkVerifierArtifact);

  const zkVerifierExists = await zkVerifier.exists();
  if (!zkVerifierExists) {
    throw new Error('MockZkVerifier does not exist');
  }

  return zkVerifier;
};

const deployMockQueryDecrypter = async (hre: HardhatRuntimeEnvironment, acl: Contract) => {
  const queryDecrypter = await hardhatDeployFromArtifact(hre, MockQueryDecrypterArtifact);

  // Initialize MockQueryDecrypter
  const initTx = await queryDecrypter.initialize(TASK_MANAGER_ADDRESS, await acl.getAddress());
  await initTx.wait();

  // Check if MockQueryDecrypter exists
  const queryDecrypterExists = await queryDecrypter.exists();
  if (!queryDecrypterExists) {
    throw new Error('MockQueryDecrypter does not exist');
  }

  return queryDecrypter;
};

const deployTestBedContract = async (hre: HardhatRuntimeEnvironment) => {
  return hardhatDeployFromArtifact(hre, TestBedArtifact);
};

// Logging

let isSilent = false;

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

const logError = (message: string, indent = 1) => {
  if (isSilent) return;
  console.log(chalk.red(`${'  '.repeat(indent)}✗ ${message}`));
};

const logDeployment = (contractName: string, address: string) => {
  if (isSilent) return;
  const paddedName = `${contractName} deployed`.padEnd(36);
  logSuccess(`${paddedName} ${chalk.bold(address)}`);
};
