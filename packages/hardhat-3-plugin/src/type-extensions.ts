import type { WalletClient } from 'viem';
import type { CofheClient, CofheConfig, CofheInputConfig } from '@cofhe/sdk';
import type { DeployMocksArgs, LogMocksDeploy } from './deploy.js';
import type {
  MockTaskManagerArtifact,
  MockACLArtifact,
  MockZkVerifierArtifact,
  MockThresholdNetworkArtifact,
  TestBedArtifact,
} from '@cofhe/mock-contracts';

import 'hardhat/types/network';

// ─── Per-connection CoFHE API ─────────────────────────────────────────────────

export interface CofheConnection {
  /**
   * Create a CoFHE configuration. Defaults to hardhat environment;
   * pass overrides as needed.
   */
  createConfig(config?: Partial<CofheInputConfig>): Promise<CofheConfig>;

  /** Create a CoFHE client instance from a config. */
  createClient(config: CofheConfig): CofheClient;

  /**
   * Create and connect a batteries-included CoFHE client.
   * If a WalletClient is provided it is used as the signer; otherwise the
   * first account from the connection is used automatically.
   */
  createClientWithBatteries(walletClient?: WalletClient): Promise<CofheClient>;

  mocks: {
    /** Deploy (or re-deploy) the mock contracts. */
    deployMocks(options?: DeployMocksArgs): Promise<void>;

    /** Execute a block with CoFHE mock logging enabled. */
    withLogs(closureName: string, closure: () => Promise<void>): Promise<void>;

    /** Enable logging from CoFHE mock contracts. */
    enableLogs(closureName?: string): Promise<void>;

    /** Disable logging from CoFHE mock contracts. */
    disableLogs(): Promise<void>;

    /** Get the plaintext value stored for a ciphertext hash. */
    getPlaintext(ctHash: bigint | string): Promise<bigint>;

    /** Assert that a ciphertext hash represents the expected plaintext value. */
    expectPlaintext(ctHash: bigint | string, expectedValue: bigint): Promise<void>;

    /** MockTaskManager contract descriptor — spread into readContract / writeContract */
    MockTaskManager: { address: `0x${string}`; abi: typeof MockTaskManagerArtifact.abi };

    /** MockACL contract descriptor */
    MockACL: { address: `0x${string}`; abi: typeof MockACLArtifact.abi };

    /** MockZkVerifier contract descriptor */
    MockZkVerifier: { address: `0x${string}`; abi: typeof MockZkVerifierArtifact.abi };

    /** MockThresholdNetwork contract descriptor */
    MockThresholdNetwork: { address: `0x${string}`; abi: typeof MockThresholdNetworkArtifact.abi };

    /** TestBed contract descriptor */
    TestBed: { address: `0x${string}`; abi: typeof TestBedArtifact.abi };
  };
}

// ─── Hardhat config augmentation ─────────────────────────────────────────────

declare module 'hardhat/types/config' {
  interface HardhatUserConfig {
    cofhe?: {
      /** Whether to log mock FHE operations (default: true) */
      logMocks?: boolean;
      /** Whether to show gas usage warnings for mock operations (default: true) */
      gasWarning?: boolean;
      /**
       * Controls deploy-mocks console output.
       * - `''`   — silent, no output
       * - `'v'`  — single summary line (default)
       * - `'vv'` — full per-contract deployment logs
       */
      mocksDeployVerbosity?: LogMocksDeploy;
    };
  }

  interface HardhatConfig {
    cofhe: {
      logMocks: boolean;
      gasWarning: boolean;
      mocksDeployVerbosity: LogMocksDeploy;
    };
  }
}

// ─── NetworkConnection augmentation ──────────────────────────────────────────

declare module 'hardhat/types/network' {
  interface NetworkConnection {
    /**
     * CoFHE mock environment — ready to use immediately after network.connect().
     * Mock contracts are deployed automatically on every connect().
     */
    cofhe: CofheConnection;
  }
}
