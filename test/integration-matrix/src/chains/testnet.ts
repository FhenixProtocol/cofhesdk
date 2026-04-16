/**
 * Shared setup helper for real chain (testnet) configurations.
 * Creates viem clients, SDK client, connects, and returns a TestContext.
 */

import { createPublicClient, createWalletClient, http } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { TEST_PRIVATE_KEY, getSimpleTestAddress } from '@cofhe/integration-test-setup';
import type { ClientFactory, TestContext, TestChainConfig } from '../types.js';

const DEFAULT_PRIVATE_KEY = '0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80';
const BOB_PRIVATE_KEY = (TEST_PRIVATE_KEY || DEFAULT_PRIVATE_KEY) as `0x${string}`;
const ALICE_PRIVATE_KEY = '0x59c6995e998f97a5a0044966f0945389dc9e86dae88c7a8412f4603b6b78690d' as const;

export function isTestnetEnabled(chainId: number): boolean {
  const contractAddress = getSimpleTestAddress(chainId);
  if (!contractAddress) return false;
  if (BOB_PRIVATE_KEY === DEFAULT_PRIVATE_KEY) return false;
  return true;
}

export function createTestnetSetup(chain: Pick<TestChainConfig, 'viemChain' | 'cofheChain' | 'rpc' | 'id'>) {
  return async (factory: ClientFactory): Promise<TestContext> => {
    const contractAddress = getSimpleTestAddress(chain.id);
    if (!contractAddress) {
      throw new Error(`No SimpleTest deployment found for chain ${chain.id}`);
    }

    const bobAccount = privateKeyToAccount(BOB_PRIVATE_KEY);
    const aliceAccount = privateKeyToAccount(ALICE_PRIVATE_KEY);

    const transport = http(chain.rpc, { timeout: 60_000, retryCount: 3 });

    const publicClient = createPublicClient({
      chain: chain.viemChain,
      transport,
      pollingInterval: 4_000,
    });

    const bobWalletClient = createWalletClient({
      chain: chain.viemChain,
      transport,
      account: bobAccount,
    });

    const aliceWalletClient = createWalletClient({
      chain: chain.viemChain,
      transport,
      account: aliceAccount,
    });

    const config = factory.createConfig({
      supportedChains: [chain.cofheChain],
    });
    const cofheClient = factory.createClient(config);
    await cofheClient.connect(publicClient, bobWalletClient);

    return {
      cofheClient,
      publicClient,
      bobWalletClient,
      aliceWalletClient,
      bobAccount,
      aliceAccount,
      contractAddress,
      chainId: chain.id,
    };
  };
}
