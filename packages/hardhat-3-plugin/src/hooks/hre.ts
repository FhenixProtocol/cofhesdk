import type { HardhatRuntimeEnvironmentHooks, NetworkHooks } from 'hardhat/types/hooks';
import type { HardhatRuntimeEnvironment } from 'hardhat/types/hre';
import { createPublicClient, createWalletClient, custom, type PublicClient, type WalletClient } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';

import {
  MockTaskManagerArtifact,
  MockACLArtifact,
  MockZkVerifierArtifact,
  MockThresholdNetworkArtifact,
  TestBedArtifact,
} from '@cofhe/mock-contracts';
import { MOCKS_ZK_VERIFIER_SIGNER_PRIVATE_KEY, type CofheInputConfig } from '@cofhe/sdk';
import { createCofheConfig, createCofheClient } from '@cofhe/sdk/node';
import { hardhat as hardhatChain } from '@cofhe/sdk/chains';

import { deployMocks, type DeployMocksArgs } from '../deploy.js';
import { mock_setLoggingEnabled, mock_withLogs } from '../logging.js';
import { mock_getPlaintext, mock_expectPlaintext } from '../utils.js';
import type { CofheConnection } from '../type-extensions.js';

// ─── Per-connection cofhe object factory ─────────────────────────────────────

function createCofheConnection(
  publicClient: PublicClient,
  walletClient: WalletClient,
  /** Reusable transport factory derived from the walletClient's request method */
  transport: ReturnType<typeof custom>
): CofheConnection {
  return {
    async createConfig(config: Partial<CofheInputConfig> = {}) {
      const zkvAccount = privateKeyToAccount(MOCKS_ZK_VERIFIER_SIGNER_PRIVATE_KEY);
      const zkvWalletClient = createWalletClient({ account: zkvAccount, transport });

      return createCofheConfig({
        environment: 'hardhat',
        supportedChains: [hardhatChain],
        ...config,
        mocks: {
          encryptDelay: 0,
          ...config.mocks,
        },
        _internal: {
          ...config._internal,
          zkvWalletClient,
        },
      });
    },

    createClient(config) {
      return createCofheClient(config);
    },

    async createClientWithBatteries(signerWalletClient?: WalletClient) {
      let signerClient: WalletClient;
      let address: `0x${string}`;

      if (signerWalletClient) {
        const [addr] = await signerWalletClient.getAddresses();
        if (!addr) throw new Error('createClientWithBatteries: provided walletClient has no accounts');
        signerClient = signerWalletClient;
        address = addr;
      } else {
        const [addr] = await walletClient.getAddresses();
        if (!addr) throw new Error('createClientWithBatteries: no accounts available on this connection');
        address = addr;
        signerClient = createWalletClient({ account: address, transport });
      }

      const config = await this.createConfig();
      const client = this.createClient(config);
      await client.connect(publicClient, signerClient);
      await client.permits.createSelf({ issuer: address });
      return client;
    },

    mocks: {
      async deployMocks(options?: DeployMocksArgs) {
        await deployMocks({ publicClient, walletClient }, options);
      },

      async withLogs(closureName: string, closure: () => Promise<void>) {
        await mock_withLogs(publicClient, walletClient, closureName, closure);
      },

      async enableLogs(closureName?: string) {
        await mock_setLoggingEnabled(publicClient, walletClient, true, closureName);
      },

      async disableLogs() {
        await mock_setLoggingEnabled(publicClient, walletClient, false);
      },

      async getPlaintext(ctHash: bigint | string) {
        const value = await mock_getPlaintext(publicClient, ctHash);
        if (value === undefined) throw new Error('getPlaintext: not on mock network');
        return value;
      },

      async expectPlaintext(ctHash: bigint | string, expectedValue: bigint) {
        await mock_expectPlaintext(publicClient, ctHash, expectedValue);
      },

      MockTaskManager: {
        address: MockTaskManagerArtifact.fixedAddress as `0x${string}`,
        abi: MockTaskManagerArtifact.abi,
      },

      async MockACL() {
        const address = await publicClient.readContract({
          address: MockTaskManagerArtifact.fixedAddress as `0x${string}`,
          abi: [
            { name: 'acl', type: 'function', inputs: [], outputs: [{ type: 'address' }], stateMutability: 'view' },
          ] as const,
          functionName: 'acl',
        });
        return { address, abi: MockACLArtifact.abi };
      },

      MockZkVerifier: {
        address: MockZkVerifierArtifact.fixedAddress as `0x${string}`,
        abi: MockZkVerifierArtifact.abi,
      },

      MockThresholdNetwork: {
        address: MockThresholdNetworkArtifact.fixedAddress as `0x${string}`,
        abi: MockThresholdNetworkArtifact.abi,
      },

      TestBed: {
        address: TestBedArtifact.fixedAddress as `0x${string}`,
        abi: TestBedArtifact.abi,
      },
    },
  };
}

// ─── HRE hook ─────────────────────────────────────────────────────────────────

const hreHooks: Partial<HardhatRuntimeEnvironmentHooks> = {
  async created(_context, hre: HardhatRuntimeEnvironment) {
    // Register a permanent newConnection handler so that every network.connect()
    // call automatically deploys mocks and attaches conn.cofhe.
    const networkHandlers: Partial<NetworkHooks> = {
      async newConnection(context, next) {
        const conn = await next(context);
        const transport = custom(conn.provider);
        const publicClient = createPublicClient({ transport });
        const walletClient = createWalletClient({ transport });
        // Derive a reusable transport factory by wrapping the walletClient's
        // request method — lets us create account-bound clients later.
        const connTransport = custom({ request: (args: any) => (walletClient as any).request(args) });

        await deployMocks(
          { publicClient, walletClient },
          {
            deployTestBed: true,
            gasWarning: hre.config.cofhe.gasWarning,
          }
        );

        (conn as any).cofhe = createCofheConnection(publicClient, walletClient, connTransport);
        return conn;
      },
    };

    hre.hooks.registerHandlers('network', networkHandlers);
  },
};

export default async (): Promise<Partial<HardhatRuntimeEnvironmentHooks>> => hreHooks;
