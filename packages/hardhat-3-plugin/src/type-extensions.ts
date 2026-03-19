import type { PublicClient, WalletClient } from 'viem';
import type { CofheClient, CofheConfig, CofheInputConfig } from '@cofhe/sdk';
import type { DeployMocksArgs } from './deploy.js';
import type {
  getMockTaskManagerContract,
  getMockACLContract,
  getMockZkVerifierContract,
  getMockThresholdNetworkContract,
  getTestBedContract,
} from './utils.js';

declare module 'hardhat/types/config' {
  interface HardhatUserConfig {
    cofhe?: {
      /** Whether to log mock FHE operations (default: true) */
      logMocks?: boolean;
      /** Whether to show gas usage warnings for mock operations (default: true) */
      gasWarning?: boolean;
    };
  }

  interface HardhatConfig {
    cofhe: {
      logMocks: boolean;
      gasWarning: boolean;
    };
  }
}

declare module 'hardhat/types/hre' {
  interface HardhatRuntimeEnvironment {
    cofhe: {
      /** Viem PublicClient for the connected network */
      publicClient: PublicClient;

      /** Viem WalletClient for the connected network */
      walletClient: WalletClient;

      /**
       * Create a CoFHE configuration for use with hre.cofhe.createClient(...)
       */
      createConfig: (config: CofheInputConfig) => Promise<CofheConfig>;

      /**
       * Create a CoFHE client instance
       */
      createClient: (config: CofheConfig) => CofheClient;

      /**
       * Create and connect a batteries-included CoFHE client.
       * If a WalletClient is provided it is used as the signer; otherwise the
       * first account from the default HRE walletClient is used automatically.
       */
      createClientWithBatteries: (walletClient?: WalletClient) => Promise<CofheClient>;

      mocks: {
        /**
         * Execute a block of code with CoFHE mock logging enabled.
         */
        withLogs: (closureName: string, closure: () => Promise<void>) => Promise<void>;

        /**
         * Enable logging from CoFHE mock contracts.
         */
        enableLogs: (closureName?: string) => Promise<void>;

        /**
         * Disable logging from CoFHE mock contracts.
         */
        disableLogs: () => Promise<void>;

        /**
         * Deploy the CoFHE mock contracts (normally done automatically before tests).
         */
        deployMocks: (options?: DeployMocksArgs) => Promise<void>;

        /**
         * Get the plaintext value stored for a ciphertext hash.
         */
        getPlaintext: (ctHash: bigint | string) => Promise<bigint>;

        /**
         * Assert that a ciphertext hash represents the expected plaintext value.
         */
        expectPlaintext: (ctHash: bigint | string, expectedValue: bigint) => Promise<void>;

        /** Get the MockTaskManager Viem contract instance */
        getMockTaskManager: () => Promise<ReturnType<typeof getMockTaskManagerContract>>;

        /** Get the MockACL Viem contract instance (address read from TaskManager) */
        getMockACL: () => Promise<Awaited<ReturnType<typeof getMockACLContract>>>;

        /** Get the MockThresholdNetwork Viem contract instance */
        getMockThresholdNetwork: () => Promise<ReturnType<typeof getMockThresholdNetworkContract>>;

        /** Get the MockZkVerifier Viem contract instance */
        getMockZkVerifier: () => Promise<ReturnType<typeof getMockZkVerifierContract>>;

        /** Get the TestBed Viem contract instance */
        getTestBed: () => Promise<ReturnType<typeof getTestBedContract>>;
      };
    };
  }
}
