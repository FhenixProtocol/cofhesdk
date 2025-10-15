import { type HardhatRuntimeEnvironment } from 'hardhat/types';
import chalk from 'chalk';
import { Contract } from 'ethers';

import {
  TASK_MANAGER_ADDRESS,
  MOCKS_ZK_VERIFIER_ADDRESS,
  MOCKS_QUERY_DECRYPTER_ADDRESS,
  TEST_BED_ADDRESS,
  MOCKS_ZK_VERIFIER_SIGNER_ADDRESS,
} from './consts.js';
import { compileMockContractPaths } from './compile.js';

// Deploy

const deployMockTaskManager = async (hre: HardhatRuntimeEnvironment) => {
  const [signer] = await hre.ethers.getSigners();

  // Deploy MockTaskManager
  const TaskManagerArtifact = await hre.artifacts.readArtifact('MockTaskManager');
  await hardhatSetCode(hre, TASK_MANAGER_ADDRESS, TaskManagerArtifact.deployedBytecode);
  const taskManager = await hre.ethers.getContractAt('MockTaskManager', TASK_MANAGER_ADDRESS);

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
  // Get Signer
  const [signer] = await hre.ethers.getSigners();

  // Deploy ACL implementation
  const aclFactory = await hre.ethers.getContractFactory('MockACL');
  const acl = await aclFactory.deploy(signer.address);
  await acl.waitForDeployment();

  // Check if ACL exists
  const exists = await acl.exists();
  if (!exists) {
    logError('MockACL does not exist', 2);
    throw new Error('MockACL does not exist');
  }

  return acl;
};

const deployMockZkVerifier = async (hre: HardhatRuntimeEnvironment) => {
  const zkVerifierArtifact = await hre.artifacts.readArtifact('MockZkVerifier');
  await hardhatSetCode(hre, MOCKS_ZK_VERIFIER_ADDRESS, zkVerifierArtifact.deployedBytecode);
  const zkVerifier = await hre.ethers.getContractAt('MockZkVerifier', MOCKS_ZK_VERIFIER_ADDRESS);

  const zkVerifierExists = await zkVerifier.exists();
  if (!zkVerifierExists) {
    logError('MockZkVerifier does not exist', 2);
    throw new Error('MockZkVerifier does not exist');
  }

  return zkVerifier;
};

const deployMockQueryDecrypter = async (hre: HardhatRuntimeEnvironment, acl: Contract) => {
  const queryDecrypterArtifact = await hre.artifacts.readArtifact('MockQueryDecrypter');
  await hardhatSetCode(hre, MOCKS_QUERY_DECRYPTER_ADDRESS, queryDecrypterArtifact.deployedBytecode);
  const queryDecrypter = await hre.ethers.getContractAt('MockQueryDecrypter', MOCKS_QUERY_DECRYPTER_ADDRESS);

  // Initialize MockQueryDecrypter
  const initTx = await queryDecrypter.initialize(TASK_MANAGER_ADDRESS, await acl.getAddress());
  await initTx.wait();

  // Check if MockQueryDecrypter exists
  const queryDecrypterExists = await queryDecrypter.exists();
  if (!queryDecrypterExists) {
    logError('MockQueryDecrypter does not exist', 2);
    throw new Error('MockQueryDecrypter does not exist');
  }

  return queryDecrypter;
};

const deployTestBedContract = async (hre: HardhatRuntimeEnvironment) => {
  const testBedFactory = await hre.artifacts.readArtifact('TestBed');
  await hardhatSetCode(hre, TEST_BED_ADDRESS, testBedFactory.deployedBytecode);
  const testBed = await hre.ethers.getContractAt('TestBed', TEST_BED_ADDRESS);
  await testBed.waitForDeployment();
  return testBed;
};

// Funding

const fundZkVerifierSigner = async (hre: HardhatRuntimeEnvironment) => {
  const zkVerifierSigner = await hre.ethers.getSigner(MOCKS_ZK_VERIFIER_SIGNER_ADDRESS);
  await hre.network.provider.send('hardhat_setBalance', [
    zkVerifierSigner.address,
    '0x' + hre.ethers.parseEther('10').toString(16),
  ]);
};

// Initializations

const setTaskManagerACL = async (taskManager: Contract, acl: Contract) => {
  const setAclTx = await taskManager.setACLContract(await acl.getAddress());
  await setAclTx.wait();
};

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
  const isHardhat = await checkNetworkAndSkip(hre);
  if (!isHardhat) return;

  const logEmptyIfNoisy = () => {
    if (!options.silent) {
      logEmpty();
    }
  };
  const logSuccessIfNoisy = (message: string, indent = 0) => {
    if (!options.silent) {
      logSuccess(message, indent);
    }
  };
  const logDeploymentIfNoisy = (contractName: string, address: string) => {
    if (!options.silent) {
      logDeployment(contractName, address);
    }
  };
  const logWarningIfNoisy = (message: string, indent = 0) => {
    if (!options.silent) {
      logWarning(message, indent);
    }
  };

  // Log start message
  logEmptyIfNoisy();
  logSuccessIfNoisy(chalk.bold('cofhe-hardhat-plugin :: deploy mocks'), 0);
  logEmptyIfNoisy();

  // Compile mock contracts
  await compileMockContractPaths(hre);
  logEmptyIfNoisy();
  logSuccessIfNoisy('Mock contracts compiled', 1);

  // Deploy mock contracts
  const taskManager = await deployMockTaskManager(hre);
  logDeploymentIfNoisy('MockTaskManager', await taskManager.getAddress());

  const acl = await deployMockACL(hre);
  logDeploymentIfNoisy('MockACL', await acl.getAddress());

  await setTaskManagerACL(taskManager, acl);
  logSuccessIfNoisy('ACL address set in TaskManager', 2);

  await fundZkVerifierSigner(hre);
  logSuccessIfNoisy(`ZkVerifier signer (${MOCKS_ZK_VERIFIER_SIGNER_ADDRESS}) funded`, 1);

  const zkVerifierSignerBalance = await hre.ethers.provider.getBalance(MOCKS_ZK_VERIFIER_SIGNER_ADDRESS);
  logSuccessIfNoisy(`ETH balance: ${zkVerifierSignerBalance.toString()}`, 2);

  const zkVerifier = await deployMockZkVerifier(hre);
  logDeploymentIfNoisy('MockZkVerifier', await zkVerifier.getAddress());

  const queryDecrypter = await deployMockQueryDecrypter(hre, acl);
  logDeploymentIfNoisy('MockQueryDecrypter', await queryDecrypter.getAddress());

  if (options.deployTestBed) {
    logSuccessIfNoisy('TestBed deployment enabled', 2);
    const testBed = await deployTestBedContract(hre);
    logDeploymentIfNoisy('TestBed', await testBed.getAddress());
  }

  // Log success message
  logEmptyIfNoisy();
  logSuccessIfNoisy(chalk.bold('cofhe-hardhat-plugin :: mocks deployed successfully'), 0);

  // Log warning about mocks increased gas costs
  if (options.gasWarning) {
    logEmptyIfNoisy();
    logWarningIfNoisy(
      "When using mocks, FHE operations (eg FHE.add / FHE.mul) report a higher gas price due to additional on-chain mocking logic. Deploy your contracts on a testnet chain to check the true gas costs.\n(Disable this warning by setting 'cofhesdk.gasWarning' to false in your hardhat config",
      0
    );
  }

  logEmptyIfNoisy();
};

// Utils

const hardhatSetCode = async (hre: HardhatRuntimeEnvironment, address: string, bytecode: string) => {
  await hre.network.provider.send('hardhat_setCode', [address, bytecode]);
};

// Network

const checkNetworkAndSkip = async (hre: HardhatRuntimeEnvironment) => {
  const network = hre.network.name;
  const isHardhat = network === 'hardhat';
  if (!isHardhat) logSuccess(`cofhe-hardhat-plugin - deploy mocks - skipped on non-hardhat network ${network}`, 0);
  return isHardhat;
};

// Logging

const logEmpty = () => {
  console.log('');
};

const logSuccess = (message: string, indent = 1) => {
  console.log(chalk.green(`${'  '.repeat(indent)}✓ ${message}`));
};

const logWarning = (message: string, indent = 1) => {
  console.log(chalk.bold(chalk.yellow(`${'  '.repeat(indent)}⚠ NOTE:`)), message);
};

const logError = (message: string, indent = 1) => {
  console.log(chalk.red(`${'  '.repeat(indent)}✗ ${message}`));
};

const logDeployment = (contractName: string, address: string) => {
  const paddedName = `${contractName} deployed`.padEnd(36);
  logSuccess(`${paddedName} ${chalk.bold(address)}`);
};
