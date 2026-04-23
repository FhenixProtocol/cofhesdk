/**
 * Hardhat mock chain configuration.
 *
 * Uses Anvil (started by globalSetup) with mock contracts deployed at fixed addresses.
 * The SDK's mock code path triggers on chain id 31337.
 */

import { inject } from 'vitest';
import { createPublicClient, createWalletClient, defineChain, http } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { hardhat as hardhatCofheChain } from '@cofhe/sdk/chains';
import { MOCKS_ZK_VERIFIER_SIGNER_PRIVATE_KEY } from '@cofhe/sdk';
import type { ClientFactory, TestContext, TestChainConfig } from '../types.js';

const ANVIL_PORT = 8546;
const ANVIL_RPC = `http://127.0.0.1:${ANVIL_PORT}`;

const BOB_PRIVATE_KEY = '0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80' as const;
const ALICE_PRIVATE_KEY = '0x59c6995e998f97a5a0044966f0945389dc9e86dae88c7a8412f4603b6b78690d' as const;

export const viemHardhat = defineChain({
  id: 31337,
  name: 'Hardhat',
  nativeCurrency: { name: 'Ether', symbol: 'ETH', decimals: 18 },
  rpcUrls: {
    default: { http: ['http://127.0.0.1:8546'] },
  },
});

async function setupHardhat(factory: ClientFactory): Promise<TestContext> {
  const contractAddress = inject('anvilSimpleTest') as `0x${string}`;
  if (!contractAddress) {
    throw new Error('anvilSimpleTest not provided. globalSetup may have failed.');
  }

  const bobAccount = privateKeyToAccount(BOB_PRIVATE_KEY);
  const aliceAccount = privateKeyToAccount(ALICE_PRIVATE_KEY);

  const publicClient = createPublicClient({
    chain: viemHardhat,
    transport: http(ANVIL_RPC),
  });

  const bobWalletClient = createWalletClient({
    chain: viemHardhat,
    transport: http(ANVIL_RPC),
    account: bobAccount,
  });

  const aliceWalletClient = createWalletClient({
    chain: viemHardhat,
    transport: http(ANVIL_RPC),
    account: aliceAccount,
  });

  const zkvAccount = privateKeyToAccount(MOCKS_ZK_VERIFIER_SIGNER_PRIVATE_KEY);
  const zkvWalletClient = createWalletClient({
    account: zkvAccount,
    transport: http(ANVIL_RPC),
  });

  const config = factory.createConfig({
    environment: 'hardhat',
    supportedChains: [hardhatCofheChain],
    mocks: { encryptDelay: 0 },
    _internal: { zkvWalletClient },
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
    chainId: 31337,
  };
}

export const hardhatChainConfig: TestChainConfig = {
  id: 31337,
  label: 'Hardhat (Mock)',
  viemChain: viemHardhat,
  cofheChain: hardhatCofheChain,
  rpc: ANVIL_RPC,
  txConfirmationsRequired: 1,
  disabled: false,
  setup: setupHardhat,
};
