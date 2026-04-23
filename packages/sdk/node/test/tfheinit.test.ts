import { Encryptable, type CofheClient } from '@/core';
import { arbSepolia as cofheArbSepolia } from '@/chains';

import { describe, it, expect, beforeAll, beforeEach } from 'vitest';
import type { PublicClient, WalletClient } from 'viem';
import { createPublicClient, createWalletClient, http } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { arbitrumSepolia as viemArbitrumSepolia } from 'viem/chains';
import { createCofheClient, createCofheConfig } from '../index.js';

const TEST_PRIVATE_KEY = '0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80';

describe('@cofhe/node - TFHE Initialization Tests', () => {
  let cofheClient: CofheClient;
  let publicClient: PublicClient;
  let walletClient: WalletClient;

  beforeAll(() => {
    publicClient = createPublicClient({
      chain: viemArbitrumSepolia,
      transport: http(),
    });

    const account = privateKeyToAccount(TEST_PRIVATE_KEY);
    walletClient = createWalletClient({
      chain: viemArbitrumSepolia,
      transport: http(),
      account,
    });
  });

  beforeEach(() => {
    const config = createCofheConfig({
      supportedChains: [cofheArbSepolia],
    });
    cofheClient = createCofheClient(config);
  });

  describe('Node TFHE Initialization', () => {
    it('should initialize node-tfhe on first encryption', async () => {
      await cofheClient.connect(publicClient, walletClient);

      const result = await cofheClient.encryptInputs([Encryptable.uint128(100n)]).execute();

      expect(result).toBeDefined();
    }, 60000);

    it('should handle multiple encryptions without re-initializing', async () => {
      await cofheClient.connect(publicClient, walletClient);

      await cofheClient.encryptInputs([Encryptable.uint128(100n)]).execute();

      await cofheClient.encryptInputs([Encryptable.uint64(50n)]).execute();
    }, 120000);
  });
});
