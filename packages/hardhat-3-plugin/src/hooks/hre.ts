import type { HardhatRuntimeEnvironmentHooks } from 'hardhat/types/hooks';
import type { HardhatRuntimeEnvironment } from 'hardhat/types/hre';
import { createPublicClient, createWalletClient, createTestClient, custom, http } from 'viem';
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

      async createClientWithBatteries(accountIndex = 0) {
        const addresses = await walletClient.getAddresses();
        const address = addresses[accountIndex];
        if (!address) {
          throw new Error(`createClientWithBatteries: no account at index ${accountIndex}`);
        }

        const config = await hre.cofhe.createConfig({
          environment: 'hardhat',
          supportedChains: [hardhatChain],
        });

        const client = hre.cofhe.createClient(config);

        const accountWalletClient = createWalletClient({
          account: address,
          transport,
        });

        await client.connect(publicClient, accountWalletClient);

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
          const c = getMockTaskManagerContract(publicClient);
          return c as unknown as import('@cofhe/mock-contracts').MockTaskManager;
        },

        async getMockACL() {
          const c = await getMockACLContract(publicClient);
          return c as unknown as import('@cofhe/mock-contracts').MockACL;
        },

        async getMockThresholdNetwork() {
          const c = getMockThresholdNetworkContract(publicClient);
          return c as unknown as import('@cofhe/mock-contracts').MockThresholdNetwork;
        },

        async getMockZkVerifier() {
          const c = getMockZkVerifierContract(publicClient);
          return c as unknown as import('@cofhe/mock-contracts').MockZkVerifier;
        },

        async getTestBed() {
          const c = getTestBedContract(publicClient);
          return c as unknown as import('@cofhe/mock-contracts').TestBed;
        },
      },
    };
  },
};

export default async (): Promise<Partial<HardhatRuntimeEnvironmentHooks>> => hreHooks;
