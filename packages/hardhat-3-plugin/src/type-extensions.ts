import type { WalletClient } from 'viem';
import type { CofheClient, CofheConfig, CofheInputConfig } from '@cofhe/sdk';
import type { DeployMocksArgs, LogMocksDeploy } from './deploy.js';
import type { AdjustableGasReceipt, AdjustedGasBreakdown } from './gas.js';
import type {
  MockTaskManagerArtifact,
  MockACLArtifact,
  MockZkVerifierArtifact,
  MockThresholdNetworkArtifact,
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

  /**
   * Returns a transaction's gas usage excluding mock-only overhead (FHE op replication,
   * decrypt-task storage, mock logging) - an estimate of what the transaction would cost
   * on a real CoFHE network. Pure function of the receipt (sums the mock task manager's
   * MockGasConsumed events from `receipt.logs`); on a real network the receipt carries no
   * such events and the raw `gasUsed` is returned unchanged.
   */
  getAdjustedGasUsed(receipt: AdjustableGasReceipt): bigint;

  /**
   * Full gas breakdown of a transaction receipt: raw `gasUsed`, the mock-only `mockGas`,
   * the `adjustedGasUsed` (raw minus mock), and the number of mock gas events.
   * See getAdjustedGasUsed.
   */
  getAdjustedGasBreakdown(receipt: AdjustableGasReceipt): AdjustedGasBreakdown;

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
       * Print a per-method gas summary after `hardhat test`, showing raw gas next to
       * adjusted gas (mock-only overhead excluded - an estimate of real-network cost).
       * (default: false)
       */
      gasSummary?: boolean;
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
      /** Print a per-method adjusted-gas summary after `hardhat test` (default: false) */
      gasSummary: boolean;
      mocksDeployVerbosity: LogMocksDeploy;
    };
  }
}

// ─── NetworkConnection augmentation ──────────────────────────────────────────

declare module 'hardhat/types/network' {
  interface NetworkConnection {
    /**
     * CoFHE mock environment — ready to use immediately after network.connect().
     * Core mock contracts are deployed automatically on every connect().
     * Contracts like SimpleTest should be deployed explicitly when a test needs them.
     */
    cofhe: CofheConnection;
  }
}
