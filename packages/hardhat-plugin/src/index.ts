/* eslint-disable no-empty-pattern */
/* eslint-disable turbo/no-undeclared-env-vars */
import chalk from 'chalk';
import { type PublicClient, type WalletClient } from 'viem';
import { extendConfig, extendEnvironment, task, types } from 'hardhat/config';
import { TASK_TEST, TASK_NODE } from 'hardhat/builtin-tasks/task-names';
import { HardhatEthersSigner } from '@nomicfoundation/hardhat-ethers/signers';
import {
  type CofheClient,
  type CofheConfig,
  type CofheInputConfig,
  MOCKS_ZK_VERIFIER_SIGNER_ADDRESS,
} from '@cofhe/sdk';
import { createCofheClient, createCofheConfig } from '@cofhe/sdk/node';
import { HardhatSignerAdapter } from '@cofhe/sdk/adapters';

import { localcofheFundAccount } from './fund.js';
import { TASK_COFHE_MOCKS_DEPLOY, TASK_COFHE_MOCKS_SET_LOG_OPS, TASK_COFHE_USE_FAUCET } from './consts.js';
import { deployMocks, type DeployMocksArgs } from './deploy.js';
import { mock_setLoggingEnabled, mock_withLogs } from './logging.js';
import { getFixedMockContract, mock_expectPlaintext } from './utils.js';
import { mock_getPlaintext } from './utils.js';
import { hardhat } from '@cofhe/sdk/chains';
import {
  MockACLArtifact,
  MockThresholdNetworkArtifact,
  MockTaskManagerArtifact,
  MockZkVerifierArtifact,
  TestBedArtifact,
  type MockACL,
  type MockTaskManager,
  type MockThresholdNetwork,
  type MockZkVerifier,
  type TestBed,
} from '@cofhe/mock-contracts';

/**
 * Configuration interface for the CoFHE Hardhat plugin.
 * Allows users to configure mock logging and gas warning settings.
 */
declare module 'hardhat/types/config' {
  interface HardhatUserConfig {
    cofhe?: {
      /** Whether to log mock operations (default: true) */
      logMocks?: boolean;
      /** Whether to show gas usage warnings for mock operations (default: true) */
      gasWarning?: boolean;
    };
  }

  interface HardhatConfig {
    cofhe: {
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
  config.cofhe = {
    logMocks: userConfig.cofhe?.logMocks ?? true,
    gasWarning: userConfig.cofhe?.gasWarning ?? true,
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
      gasWarning: hre.config.cofhe.gasWarning ?? true,
      silent: silent ?? false,
    });
  });

// Hardhat plugin auto-deploys mocks for every hardhat test run by overriding TASK_TEST and calling deployMocks(...) before runSuper()
task(TASK_TEST, 'Deploy mock contracts on hardhat').setAction(async ({}, hre, runSuper) => {
  const skipAutoDeploy = (() => {
    const raw = process.env.COFHE_SKIP_MOCKS_DEPLOY ?? '';
    const normalized = raw.trim().toLowerCase();
    return normalized === '1' || normalized === 'true' || normalized === 'yes';
  })();

  if (!skipAutoDeploy) {
    await deployMocks(hre, {
      deployTestBed: true,
      gasWarning: hre.config.cofhe.gasWarning ?? true,
    });
  }
  return runSuper();
});

task(TASK_NODE, 'Deploy mock contracts on hardhat').setAction(async ({}, hre, runSuper) => {
  const skipAutoDeploy = (() => {
    const raw = process.env.COFHE_SKIP_MOCKS_DEPLOY ?? '';
    const normalized = raw.trim().toLowerCase();
    return normalized === '1' || normalized === 'true' || normalized === 'yes';
  })();

  if (!skipAutoDeploy) {
    await deployMocks(hre, {
      deployTestBed: true,
      gasWarning: hre.config.cofhe.gasWarning ?? true,
    });
  }
  return runSuper();
});

// SET LOG OPS

task(TASK_COFHE_MOCKS_SET_LOG_OPS, 'Set logging for the Mock CoFHE contracts')
  .addParam('enable', 'Whether to enable logging', false, types.boolean)
  .setAction(async ({ enable }, hre) => {
    await mock_setLoggingEnabled(hre, enable);
  });

// MOCK UTILS

export * from './consts.js';
export * from './utils.js';
export * from './fund.js';
export * from './logging.js';
export * from './deploy.js';

/**
 * Runtime environment extensions for the CoFHE Hardhat plugin.
 * Provides access to CoFHE initialization, environment checks, and mock utilities.
 */
declare module 'hardhat/types/runtime' {
  export interface HardhatRuntimeEnvironment {
    cofhe: {
      /**
       * Create a CoFHE configuration for use with hre.cofhe.createClient(...)
       * @param {CofheInputConfig} config - The CoFHE input configuration
       * @returns {CofheConfig} The CoFHE configuration
       */
      createConfig: (config: CofheInputConfig) => Promise<CofheConfig>;
      /**
       * Create a CoFHE client instance
       * @param {CofheConfig} config - The CoFHE configuration (use createCofheConfig to create with Node.js defaults)
       * @returns {Promise<CofheClient>} The CoFHE client instance
       */
      createClient: (config: CofheConfig) => CofheClient;
      /**
       * Create viem clients from a Hardhat ethers signer, to be used with `cofheClient.connect(...)`
       * @param {HardhatEthersSigner} signer - The Hardhat ethers signer to use
       * @returns {Promise<{ publicClient: PublicClient; walletClient: WalletClient }>} The viem clients
       */
      hardhatSignerAdapter: (
        signer: HardhatEthersSigner
      ) => Promise<{ publicClient: PublicClient; walletClient: WalletClient }>;
      /**
       * Connect a CoFHE client with a Hardhat ethers signer
       * @param {CofheClient} client - The CoFHE client to connect
       * @param {HardhatEthersSigner} signer - The Hardhat ethers signer to use
       * @returns {Promise<void>}
       */
      connectWithHardhatSigner: (client: CofheClient, signer: HardhatEthersSigner) => Promise<void>;
      /**
       * Create and connect to a batteries included client.
       * Also generates a self-usage a permit for the signer.
       * If customization is needed, use createCofheClient and connectWithHardhatSigner.
       * @param {HardhatEthersSigner} signer - The Hardhat ethers signer to use (optional - defaults to first signer)
       * @returns {Promise<CofheClient>} The CoFHE client instance
       */
      createClientWithBatteries: (signer?: HardhatEthersSigner) => Promise<CofheClient>;

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
         * await hre.cofhe.mocks.withLogs("counter.increment()", async () => {
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

        /**
         * Get the MockTaskManager contract (typed via typechain)
         * @returns {Promise<MockTaskManager>} The MockTaskManager contract
         */
        getMockTaskManager: () => Promise<MockTaskManager>;

        /**
         * Get the MockACL contract (typed via typechain)
         * @returns {Promise<MockACL>} The MockACL contract
         */
        getMockACL: () => Promise<MockACL>;

        /**
         * Get the MockThresholdNetwork contract (typed via typechain)
         * @returns {Promise<MockThresholdNetwork>} The MockThresholdNetwork contract
         */
        getMockThresholdNetwork: () => Promise<MockThresholdNetwork>;

        /**
         * Get the MockZkVerifier contract (typed via typechain)
         * @returns {Promise<MockZkVerifier>} The MockZkVerifier contract
         */
        getMockZkVerifier: () => Promise<MockZkVerifier>;

        /**
         * Get the TestBed contract (typed via typechain)
         * @returns {Promise<TestBed>} The TestBed contract
         */
        getTestBed: () => Promise<TestBed>;
      };
    };
  }
}

/**
 * Builds the mocks config for the hardhat plugin.
 * Defaults `encryptDelay` to `0` so tests run without artificial wait times,
 * unless the user has explicitly provided a value.
 */
export function buildHardhatPluginMocksConfig(
  mocksConfig: CofheInputConfig['mocks']
): NonNullable<CofheInputConfig['mocks']> {
  return {
    ...mocksConfig,
    encryptDelay: mocksConfig?.encryptDelay ?? 0,
  };
}

extendEnvironment((hre) => {
  hre.cofhe = {
    createConfig: async (config: CofheInputConfig) => {
      // Create zkv wallet client
      // This wallet interacts with the MockZkVerifier contract so that the user's connected wallet doesn't have to
      const zkvHhSigner = await hre.ethers.getImpersonatedSigner(MOCKS_ZK_VERIFIER_SIGNER_ADDRESS);
      const { walletClient: zkvWalletClient } = await HardhatSignerAdapter(zkvHhSigner);

      // Inject zkv wallet client into config
      // Set encryptDelay to 0 on hardhat to avoid waiting for delays during tests
      const configWithZkvWalletClient = {
        environment: 'hardhat' as const,
        ...config,
        mocks: buildHardhatPluginMocksConfig(config.mocks),
        _internal: {
          ...config._internal,
          zkvWalletClient,
        },
      };

      return createCofheConfig(configWithZkvWalletClient);
    },
    createClient: (config: CofheConfig) => {
      return createCofheClient(config);
    },
    hardhatSignerAdapter: async (signer: HardhatEthersSigner) => {
      return HardhatSignerAdapter(signer);
    },
    connectWithHardhatSigner: async (client: CofheClient, signer: HardhatEthersSigner) => {
      const { publicClient, walletClient } = await HardhatSignerAdapter(signer);
      return client.connect(publicClient, walletClient);
    },
    createClientWithBatteries: async (signer?: HardhatEthersSigner) => {
      // Get signer if not provided
      if (!signer) {
        [signer] = await hre.ethers.getSigners();
      }

      // Create config
      const config = await hre.cofhe.createConfig({
        environment: 'hardhat',
        supportedChains: [hardhat],
      });

      // Create client
      const client = hre.cofhe.createClient(config);

      // Connect client
      await hre.cofhe.connectWithHardhatSigner(client, signer);

      // Create self-usage permit
      await client.permits.createSelf({
        issuer: signer.address,
      });

      // Return client
      return client;
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
      getMockTaskManager: async () =>
        getFixedMockContract(hre, MockTaskManagerArtifact) as unknown as Promise<MockTaskManager>,
      getMockACL: async () => {
        const taskManager = await getFixedMockContract(hre, MockTaskManagerArtifact);
        const aclAddress = await taskManager.acl();
        return hre.ethers.getContractAt(MockACLArtifact.abi, aclAddress) as unknown as MockACL;
      },
      getMockThresholdNetwork: async () =>
        getFixedMockContract(hre, MockThresholdNetworkArtifact) as unknown as Promise<MockThresholdNetwork>,
      getMockZkVerifier: async () =>
        getFixedMockContract(hre, MockZkVerifierArtifact) as unknown as Promise<MockZkVerifier>,
      getTestBed: async () =>
        getFixedMockContract(hre, TestBedArtifact) as unknown as Promise<TestBed>,
    },
  };
});
