import type {
  CofheClient,
  CofheConfig,
  CofheInputConfig,
} from '@cofhe/sdk';
import type {
  MockACL,
  MockTaskManager,
  MockThresholdNetwork,
  MockZkVerifier,
  TestBed,
} from '@cofhe/mock-contracts';
import type { DeployMocksArgs } from './deploy.js';

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
      /**
       * Create a CoFHE configuration for use with hre.cofhe.createClient(...)
       */
      createConfig: (config: CofheInputConfig) => Promise<CofheConfig>;

      /**
       * Create a CoFHE client instance
       */
      createClient: (config: CofheConfig) => CofheClient;

      /**
       * Create and connect a batteries-included CoFHE client for the given
       * account index (defaults to account 0).
       */
      createClientWithBatteries: (accountIndex?: number) => Promise<CofheClient>;

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

        /** Get the MockTaskManager contract instance */
        getMockTaskManager: () => Promise<MockTaskManager>;

        /** Get the MockACL contract instance (address read from TaskManager) */
        getMockACL: () => Promise<MockACL>;

        /** Get the MockThresholdNetwork contract instance */
        getMockThresholdNetwork: () => Promise<MockThresholdNetwork>;

        /** Get the MockZkVerifier contract instance */
        getMockZkVerifier: () => Promise<MockZkVerifier>;

        /** Get the TestBed contract instance */
        getTestBed: () => Promise<TestBed>;
      };
    };
  }
}
