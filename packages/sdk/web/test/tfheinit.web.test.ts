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

// Timing tracker to diagnose performance regressions
class StepTimingTracker {
  private stepTimings: Map<string, { start: number; end?: number; duration?: number }[]> = new Map();

  recordStepStart(stepName: string): void {
    if (!this.stepTimings.has(stepName)) {
      this.stepTimings.set(stepName, []);
    }
    const timings = this.stepTimings.get(stepName)!;
    timings.push({ start: performance.now() });
  }

  recordStepEnd(stepName: string): void {
    const timings = this.stepTimings.get(stepName);
    if (timings && timings.length > 0) {
      const lastTiming = timings[timings.length - 1];
      lastTiming.end = performance.now();
      lastTiming.duration = lastTiming.end - lastTiming.start;
    }
  }

  logTimings(testName: string): void {
    console.log(`\n[TFHE Timing] ${testName}`);
    let totalDuration = 0;
    for (const [stepName, timings] of this.stepTimings) {
      for (let i = 0; i < timings.length; i++) {
        const timing = timings[i];
        if (timing.duration !== undefined) {
          const occurrence = timings.length > 1 ? ` (occurrence ${i + 1})` : '';
          console.log(`  ${stepName}${occurrence}: ${timing.duration.toFixed(2)}ms`);
          totalDuration += timing.duration;
        }
      }
    }
    console.log(`[TFHE Timing] Total: ${totalDuration.toFixed(2)}ms\n`);
  }
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

      const timingTracker = new StepTimingTracker();
      let initTfheContext: Record<string, unknown> | undefined;

      // This will trigger real TFHE initialization in browser
      const result = await cofheClient
        .encryptInputs([Encryptable.uint128(100n)])
        .onStep((step, context) => {
          if (step === 'initTfhe') {
            if (!context?.isEnd) {
              timingTracker.recordStepStart(step);
            } else {
              timingTracker.recordStepEnd(step);
              initTfheContext = context;
            }
          }
        })
        .execute();

      timingTracker.logTimings('should initialize tfhe on first encryption');

      // If we get here, TFHE was initialized successfully
      expect(result).toBeDefined();
      expect(initTfheContext).toBeDefined();
      expect(initTfheContext?.tfheInitializationExecuted).toBe(true);
    }, 60000); // Longer timeout for real operations

    it('should handle multiple encryptions without re-initializing', async () => {
      await cofheClient.connect(publicClient, walletClient);

      const timingTracker = new StepTimingTracker();
      const initTfheContexts: Array<Record<string, unknown>> = [];
      const collectInitTfheContext = (step: string, context?: Record<string, unknown>) => {
        if (step === 'initTfhe') {
          if (!context?.isEnd) {
            timingTracker.recordStepStart(step);
          } else {
            timingTracker.recordStepEnd(step);
            initTfheContexts.push(context);
          }
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

      timingTracker.logTimings('should handle multiple encryptions without re-initializing');

      expect(firstResult).toBeDefined();
      expect(secondResult).toBeDefined();
      expect(initTfheContexts).toHaveLength(2);
      expect(initTfheContexts[1].tfheInitializationExecuted).toBe(false);
    }, 60000);
  });
});
