import { arbSepolia as cofheArbSepolia } from '@/chains';
import { Encryptable, type CofheClient } from '@/core';

import { describe, it, expect, beforeAll, beforeEach } from 'vitest';
import type { PublicClient, WalletClient } from 'viem';
import { createPublicClient, createWalletClient, http } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { arbitrumSepolia as viemArbitrumSepolia } from 'viem/chains';
import { createCofheClient, createCofheConfig } from '../index.js';

// Real test setup - runs in browser with real tfhe
const TEST_PRIVATE_KEY = '0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80';

describe('@cofhe/web - TFHE Initialization Browser Tests', () => {
  let cofheClient: CofheClient;
  let publicClient: PublicClient;
  let walletClient: WalletClient;

  beforeAll(() => {
    // Create real viem clients
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

  describe('Browser TFHE Initialization', () => {
    it('should initialize tfhe on first encryption', async () => {
      await cofheClient.connect(publicClient, walletClient);

      let initTfheContext: Record<string, unknown> | undefined;

      // This will trigger real TFHE initialization in browser
      const result = await cofheClient
        .encryptInputs([Encryptable.uint128(100n)])
        .onStep((step, context) => {
          if (step === 'initTfhe' && context?.isEnd) {
            initTfheContext = context;
          }
        })
        .execute();

      // If we get here, TFHE was initialized successfully
      expect(result).toBeDefined();
      expect(initTfheContext).toBeDefined();
      expect(initTfheContext?.tfheInitializationExecuted).toBe(true);
    }, 60000); // Longer timeout for real operations

    it('should handle multiple encryptions without re-initializing', async () => {
      await cofheClient.connect(publicClient, walletClient);

      const initTfheContexts: Array<Record<string, unknown>> = [];
      const collectInitTfheContext = (step: string, context?: Record<string, unknown>) => {
        if (step === 'initTfhe' && context?.isEnd) {
          initTfheContexts.push(context);
        }
      };

      // First encryption
      const firstResult = await cofheClient
        .encryptInputs([Encryptable.uint128(100n)])
        .onStep(collectInitTfheContext)
        .execute();

      // Second encryption should reuse initialization
      const secondResult = await cofheClient
        .encryptInputs([Encryptable.uint64(50n)])
        .onStep(collectInitTfheContext)
        .execute();

      expect(firstResult).toBeDefined();
      expect(secondResult).toBeDefined();
      expect(initTfheContexts).toHaveLength(2);
      expect(initTfheContexts[1].tfheInitializationExecuted).toBe(false);
    }, 60000);
  });
});
