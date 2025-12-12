import { describe, it, expect, beforeAll, beforeEach } from 'vitest';
import { createCofhesdkClient, createCofhesdkConfig } from './index.js';
import { Encryptable, type CofhesdkClient } from '@/core';
import { arbSepolia as cofhesdkArbSepolia } from '@/chains';
import { arbitrumSepolia as viemArbitrumSepolia } from 'viem/chains';
import { createPublicClient, createWalletClient, http, type PublicClient, type WalletClient } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';

const TEST_PRIVATE_KEY = '0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80';

describe('@cofhe/sdk/web - EncryptInputsBuilder Worker Methods', () => {
  let cofhesdkClient: CofhesdkClient;
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

  beforeEach(async () => {
    const config = createCofhesdkConfig({
      supportedChains: [cofhesdkArbSepolia],
    });
    cofhesdkClient = createCofhesdkClient(config);
    await cofhesdkClient.connect(publicClient, walletClient);
  });

  describe('setUseWorker method', () => {
    it('should have setUseWorker method on EncryptInputsBuilder', () => {
      const builder = cofhesdkClient.encryptInputs([Encryptable.uint128(100n)]);

      expect(builder).toHaveProperty('setUseWorker');
      expect(typeof builder.setUseWorker).toBe('function');
    });

    it('should return builder for method chaining', () => {
      const builder = cofhesdkClient.encryptInputs([Encryptable.uint128(100n)]);
      const returnedBuilder = builder.setUseWorker(false);

      // Should return the same builder instance (or at least same type)
      expect(returnedBuilder).toBe(builder);
    });

    it('should allow chaining with other builder methods', () => {
      // Should be able to chain setUseWorker with setStepCallback
      const builder = cofhesdkClient
        .encryptInputs([Encryptable.uint128(100n)])
        .setUseWorker(false)
        .setStepCallback(() => {});

      expect(builder).toBeDefined();
      expect(builder).toHaveProperty('encrypt');
    });

    it('should accept true parameter', () => {
      expect(() => {
        cofhesdkClient.encryptInputs([Encryptable.uint128(100n)]).setUseWorker(true);
      }).not.toThrow();
    });

    it('should accept false parameter', () => {
      expect(() => {
        cofhesdkClient.encryptInputs([Encryptable.uint128(100n)]).setUseWorker(false);
      }).not.toThrow();
    });

    it('should have getUseWorker method', () => {
      const builder = cofhesdkClient.encryptInputs([Encryptable.uint128(100n)]);

      expect(builder).toHaveProperty('getUseWorker');
      expect(typeof builder.getUseWorker).toBe('function');
    });

    it('should return current useWorker value', () => {
      const builderWithWorkers = cofhesdkClient.encryptInputs([Encryptable.uint128(100n)]).setUseWorker(true);
      const builderWithoutWorkers = cofhesdkClient.encryptInputs([Encryptable.uint128(100n)]).setUseWorker(false);

      // Should reflect config values
      expect(builderWithWorkers.getUseWorker()).toBe(true);
      expect(builderWithoutWorkers.getUseWorker()).toBe(false);
    });

    it('should reflect changes from setUseWorker', () => {
      const builder = cofhesdkClient.encryptInputs([Encryptable.uint128(100n)]).setUseWorker(true);
      expect(builder.getUseWorker()).toBe(true);

      builder.setUseWorker(false);
      expect(builder.getUseWorker()).toBe(false);

      builder.setUseWorker(true);
      expect(builder.getUseWorker()).toBe(true);
    });
  });

  describe('Worker function availability', () => {
    it('should initialize client without errors', () => {
      const config = createCofhesdkConfig({
        supportedChains: [cofhesdkArbSepolia],
        useWorkers: true,
      });

      expect(() => {
        createCofhesdkClient(config);
      }).not.toThrow();
    });

    it('should handle worker function when workers enabled', async () => {
      const config = createCofhesdkConfig({
        supportedChains: [cofhesdkArbSepolia],
        useWorkers: true,
      });

      const client = createCofhesdkClient(config);
      await client.connect(publicClient, walletClient);
      const builder = client.encryptInputs([Encryptable.uint128(100n)]);

      // Should not throw even though workers aren't available in Node
      expect(() => {
        builder.setUseWorker(true);
      }).not.toThrow();
    });

    it('should handle when workers disabled', async () => {
      const config = createCofhesdkConfig({
        supportedChains: [cofhesdkArbSepolia],
        useWorkers: false,
      });

      const client = createCofhesdkClient(config);
      await client.connect(publicClient, walletClient);
      const builder = client.encryptInputs([Encryptable.uint128(100n)]);

      expect(() => {
        builder.setUseWorker(false);
      }).not.toThrow();
    });
  });
});
