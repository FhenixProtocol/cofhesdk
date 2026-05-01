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

// Logs per-step durations using the built-in `context.duration` provided by the SDK.
// Each encryption run is a separate entry so multi-encrypt tests show per-run breakdowns.
function makeStepLogger(testName: string) {
  const runs: Array<Record<string, number>> = [];
  let current: Record<string, number> = {};

  function onStep(step: string, context?: Record<string, unknown>) {
    if (!context?.isEnd) return;
    current[step] = (context.duration as number) ?? 0;
  }

  function nextRun() {
    if (Object.keys(current).length > 0) runs.push(current);
    current = {};
  }

  function log() {
    if (Object.keys(current).length > 0) runs.push(current);
    console.log(`\n[TFHE Timing] ${testName}`);
    runs.forEach((run, i) => {
      const label = runs.length > 1 ? ` run ${i + 1}` : '';
      const total = Object.values(run).reduce((a, b) => a + b, 0);
      for (const [step, ms] of Object.entries(run)) {
        console.log(`  [${label.trim() || 'run'}] ${step}: ${ms}ms`);
      }
      console.log(`  [${label.trim() || 'run'}] total: ${total}ms`);
    });
    console.log('');
  }

  return { onStep, nextRun, log };
}

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

      const logger = makeStepLogger('should initialize tfhe on first encryption');
      let initTfheContext: Record<string, unknown> | undefined;

      // This will trigger real TFHE initialization in browser
      const result = await cofheClient
        .encryptInputs([Encryptable.uint128(100n)])
        .onStep((step, context) => {
          logger.onStep(step, context);
          if (step === 'initTfhe' && context?.isEnd) {
            initTfheContext = context;
          }
        })
        .execute();

      logger.log();

      // If we get here, TFHE was initialized successfully
      expect(result).toBeDefined();
      expect(initTfheContext).toBeDefined();
      expect(initTfheContext?.tfheInitializationExecuted).toBe(true);
    }, 60000); // Longer timeout for real operations

    it('should handle multiple encryptions without re-initializing', async () => {
      await cofheClient.connect(publicClient, walletClient);

      const logger = makeStepLogger('should handle multiple encryptions without re-initializing');
      const initTfheContexts: Array<Record<string, unknown>> = [];

      // First encryption
      const firstResult = await cofheClient
        .encryptInputs([Encryptable.uint128(100n)])
        .onStep((step, context) => {
          logger.onStep(step, context);
          if (step === 'initTfhe' && context?.isEnd) {
            initTfheContexts.push(context);
          }
        })
        .execute();

      logger.nextRun();

      // Second encryption should reuse initialization
      const secondResult = await cofheClient
        .encryptInputs([Encryptable.uint64(50n)])
        .onStep((step, context) => {
          logger.onStep(step, context);
          if (step === 'initTfhe' && context?.isEnd) {
            initTfheContexts.push(context);
          }
        })
        .execute();

      logger.log();

      expect(firstResult).toBeDefined();
      expect(secondResult).toBeDefined();
      expect(initTfheContexts).toHaveLength(2);
      expect(initTfheContexts[1].tfheInitializationExecuted).toBe(false);
    }, 120000); // Two full encryptions on real network; CI runners can be slow
  });
});
