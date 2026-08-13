/**
 * CoFHE staging chain configuration.
 *
 * Hosted staging environment for testing the consuming-contract binding fix
 * (cofhe-contracts#77 / zee-k-verifier#37) against a real verifier service. Shares its
 * chain ID (420105) with `localcofhe` - likely the same devnet genesis, hosted remotely -
 * so it cannot reuse `createTestnetSetup`/`getSimpleTestAddress`, which are keyed by
 * numeric chain ID. Uses its own contract lookup (`getStagingSimpleTestAddress`) and
 * always the standard `TEST_PRIVATE_KEY` (never the localcofhe-specific key) instead.
 */

import { defineChain, createPublicClient, createWalletClient, http } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import {
  TEST_PRIVATE_KEY,
  TEST_ALICE_PRIVATE_KEY,
  STAGING_RPC_URL,
  getStagingSimpleTestAddress,
} from '@cofhe/test-setup';
import { stagingCofhe as cofheStagingChain } from '@cofhe/sdk/chains';
import type { ClientFactory, TestContext, TestChainConfig } from '../types.js';

export const viemStagingCofhe = defineChain({
  id: 420105,
  name: 'CoFHE Staging',
  nativeCurrency: { name: 'Ether', symbol: 'ETH', decimals: 18 },
  rpcUrls: {
    default: { http: [STAGING_RPC_URL] },
  },
});

function isStagingEnabled(): boolean {
  if (!getStagingSimpleTestAddress()) return false;
  if (!TEST_PRIVATE_KEY) return false;
  return true;
}

async function setupStaging(factory: ClientFactory): Promise<TestContext> {
  const contractAddress = getStagingSimpleTestAddress();
  if (!contractAddress) {
    throw new Error('No SimpleTest deployment found for CoFHE Staging. Run `pnpm test:setup --chains 420105`.');
  }

  const bobAccount = privateKeyToAccount(TEST_PRIVATE_KEY as `0x${string}`);
  const aliceAccount = privateKeyToAccount(TEST_ALICE_PRIVATE_KEY);

  const transport = http(STAGING_RPC_URL, { timeout: 60_000, retryCount: 3 });

  const publicClient = createPublicClient({
    chain: viemStagingCofhe,
    transport,
    pollingInterval: 4_000,
  });

  const bobWalletClient = createWalletClient({
    chain: viemStagingCofhe,
    transport,
    account: bobAccount,
  });

  const aliceWalletClient = createWalletClient({
    chain: viemStagingCofhe,
    transport,
    account: aliceAccount,
  });

  const config = factory.createConfig({
    supportedChains: [cofheStagingChain],
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
    chainId: viemStagingCofhe.id,
  };
}

export const stagingChainConfig: TestChainConfig = {
  id: viemStagingCofhe.id,
  label: 'CoFHE Staging',
  viemChain: viemStagingCofhe,
  cofheChain: cofheStagingChain,
  rpc: STAGING_RPC_URL,
  txConfirmationsRequired: 1,
  disabled: !isStagingEnabled(),
  optIn: true,
  setup: setupStaging,
};
