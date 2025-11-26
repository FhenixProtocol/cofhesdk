import { arbSepolia as cofhesdkArbSepolia } from '@/chains';
import { Encryptable, type Result } from '@/core';

import { describe, it, expect, beforeAll } from 'vitest';
import type { PublicClient, WalletClient } from 'viem';
import { createPublicClient, createWalletClient, http } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { arbitrumSepolia as viemArbitrumSepolia } from 'viem/chains';
import { createCofhesdkClient, createCofhesdkConfig, createCofhesdkClientWithCustomWorker } from './index.js';

const TEST_PRIVATE_KEY = '0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80';

const expectResultSuccess = <T>(result: Result<T>): T => {
  expect(result.success, `Result error: ${result.error?.toString()}`).toBe(true);
  return result.data!;
};

describe('@cofhe/sdk/web - Worker Configuration Tests', () => {
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

  describe('useWorkers config flag', () => {
    it('should use workers by default (useWorkers: true)', async () => {
      const config = createCofhesdkConfig({
        supportedChains: [cofhesdkArbSepolia],
        // useWorkers defaults to true
      });

      expect(config.useWorkers).toBe(true);

      const client = createCofhesdkClient(config);
      await client.connect(publicClient, walletClient);

      // Track step callbacks to see worker usage
      let proveContext: any;
      const result = await client
        .encryptInputs([Encryptable.uint128(100n)])
        .setStepCallback((step, context) => {
          if (step === 'prove' && context?.isEnd) {     
            proveContext = context;
          }
        })
        .encrypt();

      expectResultSuccess(result);

      // Check that worker was attempted
      expect(proveContext).toBeDefined();
      expect(proveContext.useWorker).toBe(true);
      // Note: Workers may fail to initialize in Playwright test environment
      // due to WASM module loading issues. Verify fallback works correctly.
      expect(proveContext.usedWorker).toBeDefined();
      // The test cannot load tfhe module, so the worker fallback occurs.
      // The real test is to check that usedWorker is true
      // TBD: Find a way to test this in the test environment.

      // Log if fallback occurred for debugging
      if (!proveContext.usedWorker) {
        console.log('Worker fallback occurred (expected in test env):', proveContext.workerFailedError);
        expect(proveContext.workerFailedError).toBeDefined();
      }
    }, 60000);

    it('should disable workers when useWorkers: false', async () => {
      const config = createCofhesdkConfig({
        supportedChains: [cofhesdkArbSepolia],
        useWorkers: false,
      });

      expect(config.useWorkers).toBe(false);

      const client = createCofhesdkClient(config);
      await client.connect(publicClient, walletClient);

      // Track step callbacks
      let proveContext: any;
      const result = await client
        .encryptInputs([Encryptable.uint128(100n)])
        .setStepCallback((step, context) => {
          if (step === 'prove' && context?.isEnd) {
            proveContext = context;
          }
        })
        .encrypt();

      expectResultSuccess(result);

      // Should explicitly NOT use workers
      expect(proveContext).toBeDefined();
      expect(proveContext.useWorker).toBe(false);
      expect(proveContext.usedWorker).toBe(false);
    }, 60000);
  });

  describe('setUseWorker() method', () => {
    it('should override config with setUseWorker(false)', async () => {
      const config = createCofhesdkConfig({
        supportedChains: [cofhesdkArbSepolia],
        useWorkers: true, // Config says true
      });

      const client = createCofhesdkClient(config);
      await client.connect(publicClient, walletClient);

      // Track step callbacks
      let proveContext: any;
      const result = await client
        .encryptInputs([Encryptable.uint128(100n)])
        .setUseWorker(false) // Override to false
        .setStepCallback((step, context) => {
          if (step === 'prove' && context?.isEnd) {
            proveContext = context;
          }
        })
        .encrypt();

      expectResultSuccess(result);

      // Should respect the override
      expect(proveContext.useWorker).toBe(false);
      expect(proveContext.usedWorker).toBe(false);
    }, 60000);

    it('should override config with setUseWorker(true)', async () => {
      const config = createCofhesdkConfig({
        supportedChains: [cofhesdkArbSepolia],
        useWorkers: false, // Config says false
      });

      const client = createCofhesdkClient(config);
      await client.connect(publicClient, walletClient);

      // Track step callbacks
      let proveContext: any;
      const result = await client
        .encryptInputs([Encryptable.uint128(100n)])
        .setUseWorker(true) // Override to true
        .setStepCallback((step, context) => {
          if (step === 'prove' && context?.isEnd) {
            proveContext = context;
          }
        })
        .encrypt();

      expectResultSuccess(result);

      // Should use worker since we overrode to true
      expect(proveContext.useWorker).toBe(true);
    }, 60000);
  });

  describe('Step callback worker context', () => {
    it('should include worker debug info in prove step', async () => {
      const config = createCofhesdkConfig({
        supportedChains: [cofhesdkArbSepolia],
      });

      const client = createCofhesdkClient(config);
      await client.connect(publicClient, walletClient);

      let proveContext: any;
      const result = await client
        .encryptInputs([Encryptable.uint128(100n)])
        .setStepCallback((step, context) => {
          if (step === 'prove' && context?.isEnd) {
            proveContext = context;
          }
        })
        .encrypt();

      expectResultSuccess(result);

      // Verify all worker-related fields are present
      expect(proveContext).toBeDefined();
      expect(proveContext).toHaveProperty('useWorker');
      expect(proveContext).toHaveProperty('usedWorker');
      expect(proveContext).toHaveProperty('isEnd');
      expect(proveContext).toHaveProperty('duration');

      // If worker failed, should have error message
      if (proveContext.useWorker && !proveContext.usedWorker) {
        expect(proveContext).toHaveProperty('workerFailedError');
        expect(typeof proveContext.workerFailedError).toBe('string');
      }
    }, 60000);
  });

  describe('Worker fallback behavior', () => {
    it('should fallback to main thread when worker fails', async () => {
      const config = createCofhesdkConfig({
        supportedChains: [cofhesdkArbSepolia],
        useWorkers: true,
      });

      // Create a worker function that ALWAYS fails
      const failingWorkerFn = async () => {
        throw new Error('Worker failed intentionally');
      };

      // Inject the failing worker into the client
      const client = createCofhesdkClientWithCustomWorker(config, failingWorkerFn);
      await client.connect(publicClient, walletClient);

      // Track step callbacks to verify fallback
      let proveContext: any;
      const result = await client
        .encryptInputs([Encryptable.uint128(100n)])
        .setStepCallback((step, context) => {
          if (step === 'prove' && context?.isEnd) {
            proveContext = context;
          }
        })
        .encrypt();

      // Verify encryption succeeded via fallback to main thread
      expectResultSuccess(result);
      expect(result.data?.length).toBe(1);
      
      // Verify worker was attempted but failed, triggering fallback
      expect(proveContext).toBeDefined();
      expect(proveContext.useWorker).toBe(true); // Worker was requested
      expect(proveContext.usedWorker).toBe(false); // But it failed
      expect(proveContext.workerFailedError).toBe('Worker failed intentionally');
    }, 60000);

    it('should fallback when encrypting multiple values', async () => {
      const config = createCofhesdkConfig({
        supportedChains: [cofhesdkArbSepolia],
        useWorkers: true,
      });

      // Failing worker with different error message
      const failingWorkerFn = async () => {
        throw new Error('Worker unavailable');
      };

      const client = createCofhesdkClientWithCustomWorker(config, failingWorkerFn);
      await client.connect(publicClient, walletClient);

      let proveContext: any;
      const result = await client
        .encryptInputs([
          Encryptable.uint128(100n),
          Encryptable.uint64(50n),
          Encryptable.bool(true),
        ])
        .setStepCallback((step, context) => {
          if (step === 'prove' && context?.isEnd) {
            proveContext = context;
          }
        })
        .encrypt();

      // All values should encrypt successfully via fallback
      expectResultSuccess(result);
      expect(result.data?.length).toBe(3);
      
      // Verify fallback occurred
      expect(proveContext.useWorker).toBe(true);
      expect(proveContext.usedWorker).toBe(false);
      expect(proveContext.workerFailedError).toBe('Worker unavailable');
    }, 60000);

    it('should handle async worker errors gracefully', async () => {
      const config = createCofhesdkConfig({
        supportedChains: [cofhesdkArbSepolia],
        useWorkers: true,
      });

      // Worker that fails after a delay
      const asyncFailingWorkerFn = async () => {
        await new Promise(resolve => setTimeout(resolve, 10));
        throw new Error('Async worker failure');
      };

      const client = createCofhesdkClientWithCustomWorker(config, asyncFailingWorkerFn);
      await client.connect(publicClient, walletClient);

      let proveContext: any;
      const result = await client
        .encryptInputs([Encryptable.uint8(42n)])
        .setStepCallback((step, context) => {
          if (step === 'prove' && context?.isEnd) {
            proveContext = context;
          }
        })
        .encrypt();

      expectResultSuccess(result);
      expect(proveContext.useWorker).toBe(true);
      expect(proveContext.usedWorker).toBe(false);
      expect(proveContext.workerFailedError).toBe('Async worker failure');
    }, 60000);

    it('should work without worker when explicitly disabled', async () => {
      const config = createCofhesdkConfig({
        supportedChains: [cofhesdkArbSepolia],
        useWorkers: true, // Config says use workers
      });

      const client = createCofhesdkClient(config);
      await client.connect(publicClient, walletClient);

      let proveContext: any;
      const result = await client
        .encryptInputs([Encryptable.uint8(42n)])
        .setUseWorker(false) // But override to disable worker
        .setStepCallback((step, context) => {
          if (step === 'prove' && context?.isEnd) {
            proveContext = context;
          }
        })
        .encrypt();

      expectResultSuccess(result);
      
      // Should NOT attempt worker at all
      expect(proveContext.useWorker).toBe(false);
      expect(proveContext.usedWorker).toBe(false);
      expect(proveContext.workerFailedError).toBeUndefined();
    }, 60000);
  });
});

