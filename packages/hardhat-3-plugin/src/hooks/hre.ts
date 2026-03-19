import type { HardhatRuntimeEnvironmentHooks } from 'hardhat/types/hooks';
import type { HardhatRuntimeEnvironment } from 'hardhat/types/hre';
import { createPublicClient, createWalletClient, createTestClient, custom, type WalletClient } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';

import {
  MockTaskManagerArtifact,
  MockACLArtifact,
  MockZkVerifierArtifact,
  MockThresholdNetworkArtifact,
  TestBedArtifact,
} from '@cofhe/mock-contracts';
import {
  TASK_MANAGER_ADDRESS,
  MOCKS_ZK_VERIFIER_SIGNER_ADDRESS,
  MOCKS_ZK_VERIFIER_SIGNER_PRIVATE_KEY,
  type CofheInputConfig,
} from '@cofhe/sdk';
import { createCofheConfig, createCofheClient } from '@cofhe/sdk/node';
import { hardhat as hardhatChain } from '@cofhe/sdk/chains';
import { getContract } from 'viem';

import { deployMocks, type DeployMocksArgs } from '../deploy.js';
import { mock_setLoggingEnabled, mock_withLogs } from '../logging.js';
import { mock_getPlaintext, mock_expectPlaintext, getMockACLContract } from '../utils.js';
import {
  getMockTaskManagerContract,
  getMockZkVerifierContract,
  getMockThresholdNetworkContract,
  getTestBedContract,
} from '../utils.js';

const hreHooks: Partial<HardhatRuntimeEnvironmentHooks> = {
  async created(_context, hre: HardhatRuntimeEnvironment) {
    // Connect to the default network and create viem clients
    const connection = await hre.network.connect();
    const provider = connection.provider;

    const transport = custom(provider);

    const publicClient = createPublicClient({ transport });
    const walletClient = createWalletClient({ transport });
    const testClient = createTestClient({ mode: 'hardhat', transport });

    const networkName = connection.networkName;

    const deployCtx = {
      provider,
      publicClient,
      walletClient,
      testClient,
      networkName,
    };

    // ─── hre.cofhe ────────────────────────────────────────────────────────────

    hre.cofhe = {
      publicClient,
      walletClient,

      async createConfig(config: CofheInputConfig) {
        // Create a wallet client for the ZkVerifier signer — injected into the
        // SDK config so it can call the MockZkVerifier contract internally.
        const zkvAccount = privateKeyToAccount(MOCKS_ZK_VERIFIER_SIGNER_PRIVATE_KEY);
        const zkvWalletClient = createWalletClient({
          account: zkvAccount,
          transport,
        });

        return createCofheConfig({
          environment: 'hardhat',
          ...config,
          mocks: {
            ...config.mocks,
            encryptDelay: config.mocks?.encryptDelay ?? 0,
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
        // Resolve the account-bound wallet client to use for signing.
        // The HRE's default walletClient is account-less; createSelf() needs
        // a walletClient with an explicit account attached.
        let signerClient: WalletClient;
        let address: `0x${string}`;

        if (signerWalletClient) {
          const [addr] = await signerWalletClient.getAddresses();
          if (!addr) throw new Error('createClientWithBatteries: provided walletClient has no accounts');
          signerClient = signerWalletClient;
          address = addr;
        } else {
          const [addr] = await walletClient.getAddresses();
          if (!addr) throw new Error('createClientWithBatteries: no accounts available on the default walletClient');
          address = addr;
          signerClient = createWalletClient({ account: address, transport });
        }

        const config = await hre.cofhe.createConfig({
          environment: 'hardhat',
          supportedChains: [hardhatChain],
        });

        const client = hre.cofhe.createClient(config);

        await client.connect(publicClient, signerClient);

        await client.permits.createSelf({ issuer: address });

        return client;
      },

      mocks: {
        async deployMocks(options?: DeployMocksArgs) {
          await deployMocks(deployCtx, options);
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

        async getMockTaskManager() {
          return getMockTaskManagerContract(publicClient);
        },

        async getMockACL() {
          return getMockACLContract(publicClient);
        },

        async getMockThresholdNetwork() {
          return getMockThresholdNetworkContract(publicClient);
        },

        async getMockZkVerifier() {
          return getMockZkVerifierContract(publicClient);
        },

        async getTestBed() {
          return getTestBedContract(publicClient);
        },
      },
    };
  },
};

export default async (): Promise<Partial<HardhatRuntimeEnvironmentHooks>> => hreHooks;
