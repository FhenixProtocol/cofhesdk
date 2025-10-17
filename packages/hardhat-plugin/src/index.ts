/* eslint-disable no-empty-pattern */
/* eslint-disable turbo/no-undeclared-env-vars */
/* eslint-disable no-unused-vars */
import chalk from 'chalk';
import { type PublicClient, type WalletClient } from 'viem';
import { extendConfig, extendEnvironment, task, types } from 'hardhat/config';
import { TASK_TEST, TASK_NODE } from 'hardhat/builtin-tasks/task-names';
import { HardhatEthersSigner } from '@nomicfoundation/hardhat-ethers/signers';
import { type CofhesdkClient, type CofhesdkConfig, type CofhesdkInputConfig, type Result } from 'cofhesdk';
import { createCofhesdkClient, createCofhesdkConfig } from 'cofhesdk/node';
import { HardhatSignerAdapter } from 'cofhesdk/adapters';

import { localcofheFundAccount } from './fund.js';
import {
  MOCKS_ZK_VERIFIER_SIGNER_ADDRESS,
  TASK_COFHE_MOCKS_DEPLOY,
  TASK_COFHE_MOCKS_SET_LOG_OPS,
  TASK_COFHE_USE_FAUCET,
} from './consts.js';
import { deployMocks, type DeployMocksArgs } from './deploy.js';
import { mock_setLoggingEnabled, mock_withLogs } from './logging.js';
import { mock_expectPlaintext } from './utils.js';
import { mock_getPlaintext } from './utils.js';
import {
  expectResultError,
  expectResultPartialValue,
  expectResultSuccess,
  expectResultValue,
} from './expectResultUtils.js';
export {
  MockACLArtifact,
  MockQueryDecrypterArtifact,
  MockTaskManagerArtifact,
  MockZkVerifierArtifact,
  TestBedArtifact,
} from '@cofhesdk/mock-contracts';

/**
 * Configuration interface for the CoFHE Hardhat plugin.
 * Allows users to configure mock logging and gas warning settings.
 */
declare module 'hardhat/types/config' {
  interface HardhatUserConfig {
    cofhesdk?: {
      /** Whether to log mock operations (default: true) */
      logMocks?: boolean;
      /** Whether to show gas usage warnings for mock operations (default: true) */
      gasWarning?: boolean;
    };
  }

  interface HardhatConfig {
    cofhesdk: {
      /** Whether to log mock operations (default: true) */
      logMocks: boolean;
      /** Whether to show gas usage warnings for mock operations (default: true) */
      gasWarning: boolean;
    };
  }
}

extendConfig((config, userConfig) => {
  // Allow users to override the localcofhe network config
  if (userConfig.networks && userConfig.networks.localcofhe) {
    return;
  }

  // Default config
  config.networks.localcofhe = {
    gas: 'auto',
    gasMultiplier: 1.2,
    gasPrice: 'auto',
    timeout: 10_000,
    httpHeaders: {},
    url: 'http://127.0.0.1:42069',
    accounts: [
      '0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80',
      '0x59c6995e998f97a5a0044966f0945389dc9e86dae88c7a8412f4603b6b78690d',
      '0x5de4111afa1a4b94908f83103eb1f1706367c2e68ca870fc3fb9a804cdab365a',
      '0x7c852118294e51e653712a81e05800f419141751be58f605c371e15141b007a6',
    ],
  };

  // Only add Sepolia config if user hasn't defined it
  if (!userConfig.networks?.['eth-sepolia']) {
    config.networks['eth-sepolia'] = {
      url: process.env.SEPOLIA_RPC_URL ?? 'https://ethereum-sepolia.publicnode.com',
      accounts: process.env.PRIVATE_KEY ? [process.env.PRIVATE_KEY] : [],
      chainId: 11155111,
      gas: 'auto',
      gasMultiplier: 1.2,
      gasPrice: 'auto',
      timeout: 60_000,
      httpHeaders: {},
    };
  }

  // Only add Arbitrum Sepolia config if user hasn't defined it
  if (!userConfig.networks?.['arb-sepolia']) {
    config.networks['arb-sepolia'] = {
      url: process.env.ARBITRUM_SEPOLIA_RPC_URL ?? 'https://sepolia-rollup.arbitrum.io/rpc',
      accounts: process.env.PRIVATE_KEY ? [process.env.PRIVATE_KEY] : [],
      chainId: 421614,
      gas: 'auto',
      gasMultiplier: 1.2,
      gasPrice: 'auto',
      timeout: 60_000,
      httpHeaders: {},
    };
  }

  // Add cofhe config
  config.cofhesdk = {
    logMocks: userConfig.cofhesdk?.logMocks ?? true,
    gasWarning: userConfig.cofhesdk?.gasWarning ?? true,
  };
});

type UseFaucetArgs = {
  address?: string;
};

task(TASK_COFHE_USE_FAUCET, 'Fund an account from the funder')
  .addOptionalParam('address', 'Address to fund', undefined, types.string)
  .setAction(async ({ address }: UseFaucetArgs, hre) => {
    const { network } = hre;
    const { name: networkName } = network;

    if (networkName !== 'localcofhe') {
      console.info(chalk.yellow(`Programmatic faucet only supported for localcofhe`));
      return;
    }

    if (!address) {
      console.info(chalk.red(`Failed to get address to fund`));
      return;
    }

    console.info(chalk.green(`Getting funds from faucet for ${address}`));

    try {
      await localcofheFundAccount(hre, address);
    } catch (e) {
      console.info(chalk.red(`failed to get funds from localcofhe for ${address}: ${e}`));
    }
  });

// DEPLOY TASKS

task(TASK_COFHE_MOCKS_DEPLOY, 'Deploys the mock contracts on the Hardhat network')
  .addOptionalParam('deployTestBed', 'Whether to deploy the test bed', true, types.boolean)
  .addOptionalParam('silent', 'Whether to suppress output', false, types.boolean)
  .setAction(async ({ deployTestBed, silent }: DeployMocksArgs, hre) => {
    await deployMocks(hre, {
      deployTestBed: deployTestBed ?? true,
      gasWarning: hre.config.cofhesdk.gasWarning ?? true,
      silent: silent ?? false,
    });
  });

task(TASK_TEST, 'Deploy mock contracts on hardhat').setAction(async ({}, hre, runSuper) => {
  await deployMocks(hre, {
    deployTestBed: true,
    gasWarning: hre.config.cofhesdk.gasWarning ?? true,
  });
  return runSuper();
});

task(TASK_NODE, 'Deploy mock contracts on hardhat').setAction(async ({}, hre, runSuper) => {
  await deployMocks(hre, {
    deployTestBed: true,
    gasWarning: hre.config.cofhesdk.gasWarning ?? true,
  });
  return runSuper();
});

// SET LOG OPS

task(TASK_COFHE_MOCKS_SET_LOG_OPS, 'Set logging for the Mock CoFHE contracts')
  .addParam('enable', 'Whether to enable logging', false, types.boolean)
  .setAction(async ({ enable }, hre) => {
    await mock_setLoggingEnabled(hre, enable);
  });

// MOCK UTILS

export * from './utils.js';
export * from './expectResultUtils.js';
export * from './fund.js';
export * from './logging.js';
export * from './deploy.js';

/**
 * Runtime environment extensions for the CoFHE Hardhat plugin.
 * Provides access to CoFHE initialization, environment checks, and mock utilities.
 */
declare module 'hardhat/types/runtime' {
  export interface HardhatRuntimeEnvironment {
    cofhesdk: {
      /**
       * Create a CoFHE SDK configuration for use with cofhesdk.createCofhesdkClient(...)
       * @param {CofhesdkInputConfig} config - The CoFHE SDK input configuration
       * @returns {CofhesdkConfig} The CoFHE SDK configuration
       */
      createCofhesdkConfig: (config: CofhesdkInputConfig) => Promise<CofhesdkConfig>;
      /**
       * Create a CoFHE SDK client instance
       * @param {CofhesdkConfig} config - The CoFHE SDK configuration (use createCofhesdkConfig to create with Node.js defaults)
       * @returns {Promise<CofhesdkClient>} The CoFHE SDK client instance
       */
      createCofhesdkClient: (config: CofhesdkConfig) => CofhesdkClient;
      /**
       * Create viem clients from a Hardhat ethers signer, to be used with `cofhesdkClient.connect(...)`
       * @param {HardhatEthersSigner} signer - The Hardhat ethers signer to use
       * @returns {Promise<{ publicClient: PublicClient; walletClient: WalletClient }>} The viem clients
       */
      hardhatSignerAdapter: (
        signer: HardhatEthersSigner
      ) => Promise<{ publicClient: PublicClient; walletClient: WalletClient }>;

      /**
       * Assert that a Result type returned from a function is successful and return its value (result.success === true)
       * @param {Result<T>} result - The Result to check
       * @returns {T} The inner data of the Result (non null)
       */
      expectResultSuccess: <T>(result: Result<T> | Promise<Result<T>>) => Promise<T>;

      /**
       * Assert that a Result type contains an error matching the partial string (result.success === false && result.error.includes(errorPartial))
       * @param {Result<T>} result - The Result to check
       * @param {string} errorPartial - The partial error string to match
       */
      expectResultError: <T>(result: Result<T> | Promise<Result<T>>, errorPartial: string) => Promise<void>;

      /**
       * Assert that a Result type contains a specific value (result.success === true && result.data === value)
       * @param {Result<T>} result - The Result to check
       * @param {T} value - The inner data of the Result (non null)
       */
      expectResultValue: <T>(result: Result<T> | Promise<Result<T>>, value: T) => Promise<T>;

      /**
       * Assert that a Result type contains a value matching the partial object (result.success === true && result.data.includes(partial))
       * @param {Result<T>} result - The Result to check
       * @param {Partial<T>} partial - The partial object to match against
       * @returns {T} The inner data of the Result (non null)
       */
      expectResultPartialValue: <T>(result: Result<T> | Promise<Result<T>>, partial: Partial<T>) => Promise<T>;

      mocks: {
        /**
         * **[MOCKS ONLY]**
         *
         * Execute a block of code with cofhe mock contracts logging enabled.
         *
         * _(If logging only a function, we recommend passing the function name as the closureName (ex "counter.increment()"))_
         *
         * Example usage:
         *
         * ```ts
         * await hre.cofhesdk.mocks.withLogs("counter.increment()", async () => {
         *   await counter.increment();
         * });
         * ```
         *
         * Expected output:
         * ```
         * ┌──────────────────┬──────────────────────────────────────────────────
         * │ [COFHE-MOCKS]    │ "counter.increment()" logs:
         * ├──────────────────┴──────────────────────────────────────────────────
         * ├ FHE.add          | euint32(4473..3424)[0] + euint32(1157..3648)[1]  =>  euint32(1106..1872)[1]
         * ├ FHE.allowThis    | euint32(1106..1872)[1] -> 0x663f..6602
         * ├ FHE.allow        | euint32(1106..1872)[1] -> 0x3c44..93bc
         * └─────────────────────────────────────────────────────────────────────
         * ```
         * @param {string} closureName - Name of the code block to log within
         * @param {() => Promise<void>} closure - The async function to execute
         */
        withLogs: (closureName: string, closure: () => Promise<void>) => Promise<void>;

        /**
         * **[MOCKS ONLY]**
         *
         * Enable logging from cofhe mock contracts
         * @param {string} closureName - Optional name of the code block to enable logging for
         */
        enableLogs: (closureName?: string) => Promise<void>;

        /**
         * **[MOCKS ONLY]**
         *
         * Disable logging from cofhe mock contracts
         */
        disableLogs: () => Promise<void>;

        /**
         * **[MOCKS ONLY]**
         *
         * Deploy the cofhe mock contracts (normally this is done automatically)
         * @param {DeployMocksArgs} options - Deployment options
         */
        deployMocks: (options: DeployMocksArgs) => Promise<void>;

        /**
         * **[MOCKS ONLY]**
         *
         * Get the plaintext value for a ciphertext hash
         * @param {bigint} ctHash - The ciphertext hash to look up
         * @returns {Promise<bigint>} The plaintext value
         */
        getPlaintext: (ctHash: bigint) => Promise<bigint>;

        /**
         * **[MOCKS ONLY]**
         *
         * Assert that a ciphertext hash represents an expected plaintext value
         * @param {bigint} ctHash - The ciphertext hash to check
         * @param {bigint} expectedValue - The expected plaintext value
         */
        expectPlaintext: (ctHash: bigint, expectedValue: bigint) => Promise<void>;
      };
    };
  }
}

extendEnvironment((hre) => {
  hre.cofhesdk = {
    createCofhesdkConfig: async (config: CofhesdkInputConfig) => {
      // Create zkv wallet client
      // This wallet interacts with the MockZkVerifier contract so that the user's connected wallet doesn't have to
      const zkvHhSigner = await hre.ethers.getImpersonatedSigner(MOCKS_ZK_VERIFIER_SIGNER_ADDRESS);
      const { walletClient: zkvWalletClient } = await HardhatSignerAdapter(zkvHhSigner);

      // Inject zkv wallet client into config
      const configWithZkvWalletClient = {
        ...config,
        _internal: {
          ...config._internal,
          zkvWalletClient,
        },
      };

      return createCofhesdkConfig(configWithZkvWalletClient);
    },
    createCofhesdkClient: (config: CofhesdkConfig) => {
      return createCofhesdkClient(config);
    },
    hardhatSignerAdapter: async (signer: HardhatEthersSigner) => {
      return HardhatSignerAdapter(signer);
    },
    expectResultSuccess: async <T>(result: Result<T> | Promise<Result<T>>) => {
      const awaitedResult = await result;
      return expectResultSuccess(awaitedResult);
    },
    expectResultError: async <T>(result: Result<T> | Promise<Result<T>>, errorPartial: string) => {
      const awaitedResult = await result;
      return expectResultError(awaitedResult, errorPartial);
    },
    expectResultValue: async <T>(result: Result<T> | Promise<Result<T>>, value: T) => {
      const awaitedResult = await result;
      return expectResultValue(awaitedResult, value);
    },
    expectResultPartialValue: async <T>(result: Result<T> | Promise<Result<T>>, partial: Partial<T>) => {
      const awaitedResult = await result;
      return expectResultPartialValue(awaitedResult, partial);
    },
    mocks: {
      withLogs: async (closureName: string, closure: () => Promise<void>) => {
        return mock_withLogs(hre, closureName, closure);
      },
      enableLogs: async (closureName?: string) => {
        return mock_setLoggingEnabled(hre, true, closureName);
      },
      disableLogs: async () => {
        return mock_setLoggingEnabled(hre, false);
      },
      deployMocks: async (options: DeployMocksArgs) => {
        return deployMocks(hre, options);
      },
      getPlaintext: async (ctHash: bigint) => {
        const [signer] = await hre.ethers.getSigners();
        return mock_getPlaintext(signer.provider, ctHash);
      },
      expectPlaintext: async (ctHash: bigint, expectedValue: bigint) => {
        const [signer] = await hre.ethers.getSigners();
        return mock_expectPlaintext(signer.provider, ctHash, expectedValue);
      },
    },
  };
});
