import { type HardhatRuntimeEnvironment } from 'hardhat/types';
import chalk from 'chalk';
import { Contract } from 'ethers';
import path from 'path';
import fs from 'fs';

import {
  TASK_MANAGER_ADDRESS,
  MOCKS_ZK_VERIFIER_ADDRESS,
  MOCKS_QUERY_DECRYPTER_ADDRESS,
  TEST_BED_ADDRESS,
  MOCKS_ZK_VERIFIER_SIGNER_ADDRESS,
} from '@cofhe/sdk';

// Deploy

const deployMockTaskManager = async (hre: HardhatRuntimeEnvironment) => {
  const [signer] = await hre.ethers.getSigners();

  // Deploy MockTaskManager
  const artifact = await hre.artifacts.readArtifact('MockTaskManager');
  await hardhatSetCode(hre, TASK_MANAGER_ADDRESS, artifact.deployedBytecode);
  const taskManager = await hre.ethers.getContractAt(artifact.abi, TASK_MANAGER_ADDRESS);

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
  const artifact = await hre.artifacts.readArtifact('MockACL');
  const acl = await ethersDeployContract(hre, artifact.abi, artifact.bytecode);

  // Check if ACL exists
  const exists = await acl.exists();
  if (!exists) {
    logError('MockACL does not exist', 2);
    throw new Error('MockACL does not exist');
  }

  return acl;
};

const deployMockZkVerifier = async (hre: HardhatRuntimeEnvironment) => {
  const artifact = await hre.artifacts.readArtifact('MockZkVerifier');
  await hardhatSetCode(hre, MOCKS_ZK_VERIFIER_ADDRESS, artifact.deployedBytecode);
  const zkVerifier = await hre.ethers.getContractAt(artifact.abi, MOCKS_ZK_VERIFIER_ADDRESS);

  const zkVerifierExists = await zkVerifier.exists();
  if (!zkVerifierExists) {
    logError('MockZkVerifier does not exist', 2);
    throw new Error('MockZkVerifier does not exist');
  }

  return zkVerifier;
};

const deployMockQueryDecrypter = async (hre: HardhatRuntimeEnvironment, acl: Contract) => {
  const artifact = await hre.artifacts.readArtifact('MockQueryDecrypter');
  await hardhatSetCode(hre, MOCKS_QUERY_DECRYPTER_ADDRESS, artifact.deployedBytecode);
  const queryDecrypter = await hre.ethers.getContractAt(artifact.abi, MOCKS_QUERY_DECRYPTER_ADDRESS);

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
  const artifact = await hre.artifacts.readArtifact('TestBed');
  await hardhatSetCode(hre, TEST_BED_ADDRESS, artifact.deployedBytecode);
  const testBed = await hre.ethers.getContractAt(artifact.abi, TEST_BED_ADDRESS);
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

/**
 * Resolve a module path that works in both ESM and CJS
 */
function resolveModulePath(moduleName: string): string {
  // Try using standard Node.js require.resolve
  // In CJS context, require is available globally
  // In ESM context that's transpiled to CJS, require is also available
  try {
    // This works in both CJS and transpiled ESM
    // @ts-ignore - require might not be in types but it exists at runtime in CJS
    if (typeof require !== 'undefined' && typeof require.resolve === 'function') {
      // @ts-ignore
      return require.resolve(moduleName);
    }
  } catch (e) {
    // Fallback: try to construct path manually
  }

  // Fallback: search in node_modules
  const nodeModulesPath = path.join(process.cwd(), 'node_modules', moduleName);
  if (fs.existsSync(nodeModulesPath)) {
    return nodeModulesPath;
  }

  throw new Error(`Could not resolve module: ${moduleName}`);
}

/**
 * Ensure mock contracts are compiled and available in artifacts
 */
const compileMockContracts = async (hre: HardhatRuntimeEnvironment) => {
  try {
    // Find the mock-contracts package
    const mockContractsPackageJson = resolveModulePath('@cofhe/mock-contracts/package.json');
    const mockContractsRoot = path.dirname(mockContractsPackageJson);
    const mockContractsPath = path.join(mockContractsRoot, 'contracts');

    // Create a directory in the user's contracts directory for the mock contracts
    const userContractsDir = hre.config.paths.sources;
    const targetPath = path.join(userContractsDir, '.cofhe-mocks');

    // Remove existing directory if it exists
    if (fs.existsSync(targetPath)) {
      fs.rmSync(targetPath, { recursive: true, force: true });
    }

    // Create the target directory
    fs.mkdirSync(targetPath, { recursive: true });

    // Copy only .sol files from the root of contracts directory, excluding foundry/ subdirectory
    const files = fs.readdirSync(mockContractsPath);
    for (const file of files) {
      const sourcePath = path.join(mockContractsPath, file);
      const stat = fs.statSync(sourcePath);

      // Skip the foundry directory and any other directories
      if (stat.isDirectory()) {
        continue;
      }

      // Copy .sol files
      if (file.endsWith('.sol')) {
        const targetFilePath = path.join(targetPath, file);
        fs.copyFileSync(sourcePath, targetFilePath);
      }
    }

    // Compile with the copied contracts
    await hre.run('compile', { quiet: true });

    // Clean up after compilation
    if (fs.existsSync(targetPath)) {
      fs.rmSync(targetPath, { recursive: true, force: true });
    }
  } catch (error) {
    console.error('Failed to compile mock contracts:', error);
    throw error;
  }
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

  // Compile mock contracts to create artifacts
  await compileMockContracts(hre);

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
      "When using mocks, FHE operations (eg FHE.add / FHE.mul) report a higher gas price due to additional on-chain mocking logic. Deploy your contracts on a testnet chain to check the true gas costs.\n(Disable this warning by setting '@cofhe/sdk.gasWarning' to false in your hardhat config",
      0
    );
  }

  logEmptyIfNoisy();
};

// Utils

const hardhatSetCode = async (hre: HardhatRuntimeEnvironment, address: string, bytecode: string) => {
  await hre.network.provider.send('hardhat_setCode', [address, bytecode]);
};

const ethersDeployContract = async (hre: HardhatRuntimeEnvironment, abi: any, bytecode: string) => {
  const [signer] = await hre.ethers.getSigners();

  const factory = new hre.ethers.ContractFactory(abi, bytecode, signer);
  const contract = await factory.deploy(/* constructor args */);
  await contract.waitForDeployment();

  return contract as Contract;
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
