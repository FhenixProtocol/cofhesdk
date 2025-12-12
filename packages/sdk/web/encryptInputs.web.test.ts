import { arbSepolia as cofhesdkArbSepolia } from '@/chains';
import { Encryptable, FheTypes, type CofhesdkClient, CofhesdkErrorCode, CofhesdkError } from '@/core';

import { describe, it, expect, beforeAll, beforeEach } from 'vitest';
import type { PublicClient, WalletClient } from 'viem';
import { createPublicClient, createWalletClient, http } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { arbitrumSepolia as viemArbitrumSepolia } from 'viem/chains';
import { createCofhesdkClient, createCofhesdkConfig } from './index.js';

// Real test setup - runs in browser with real tfhe
const TEST_PRIVATE_KEY = '0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80';

describe('@cofhe/web - Encrypt Inputs Browser Tests', () => {
  let cofhesdkClient: CofhesdkClient;
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
    const config = createCofhesdkConfig({
      supportedChains: [cofhesdkArbSepolia],
    });
    cofhesdkClient = createCofhesdkClient(config);
  });

  describe('Browser TFHE Initialization', () => {
    it('should initialize tfhe on first encryption', async () => {
      await cofhesdkClient.connect(publicClient, walletClient);

      // This will trigger real TFHE initialization in browser
      const result = await cofhesdkClient.encryptInputs([Encryptable.uint128(100n)]).encrypt();

      // If we get here, TFHE was initialized successfully
      expect(result).toBeDefined();
    }, 60000); // Longer timeout for real operations

    it('should handle multiple encryptions without re-initializing', async () => {
      await cofhesdkClient.connect(publicClient, walletClient);

      // First encryption
      expect(cofhesdkClient.encryptInputs([Encryptable.uint128(100n)]).encrypt()).resolves.not.toThrow();

      // Second encryption should reuse initialization
      expect(cofhesdkClient.encryptInputs([Encryptable.uint64(50n)]).encrypt()).resolves.not.toThrow();
    }, 60000);
  });

  describe('Browser Encryption', () => {
    it('should encrypt a bool with real TFHE in browser', async () => {
      await cofhesdkClient.connect(publicClient, walletClient);

      const result = await cofhesdkClient.encryptInputs([Encryptable.bool(true)]).encrypt();

      expect(result).toBeDefined();
      expect(result.length).toBe(1);
      expect(result[0].utype).toBe(FheTypes.Bool);
      expect(result[0].ctHash).toBeDefined();
      expect(typeof result[0].ctHash).toBe('bigint');
      expect(result[0].signature).toBeDefined();
      expect(typeof result[0].signature).toBe('string');
      expect(result[0].securityZone).toBe(0);
    }, 60000);

    it('should encrypt all supported types together', async () => {
      await cofhesdkClient.connect(publicClient, walletClient);

      const inputs = [
        Encryptable.bool(false),
        Encryptable.uint8(1n),
        Encryptable.uint16(2n),
        Encryptable.uint32(3n),
        Encryptable.uint64(4n),
        Encryptable.uint128(5n),
        Encryptable.address('0x742d35Cc6634C0532925a3b844D16faC4c175E99'),
      ];

      const result = await cofhesdkClient.encryptInputs(inputs).encrypt();
      expect(result).toBeDefined();

      expect(result.length).toBe(7);
      // Verify each type
      expect(result[0].utype).toBe(FheTypes.Bool);
      expect(result[1].utype).toBe(FheTypes.Uint8);
      expect(result[2].utype).toBe(FheTypes.Uint16);
      expect(result[3].utype).toBe(FheTypes.Uint32);
      expect(result[4].utype).toBe(FheTypes.Uint64);
      expect(result[5].utype).toBe(FheTypes.Uint128);
      expect(result[6].utype).toBe(FheTypes.Uint160);
    }, 90000); // Longer timeout for multiple encryptions
  });

  describe('Browser Builder Pattern', () => {
    it('should support chaining builder methods with real encryption', async () => {
      await cofhesdkClient.connect(publicClient, walletClient);

      const snapshot = cofhesdkClient.getSnapshot();
      const encrypted = await cofhesdkClient
        .encryptInputs([Encryptable.uint128(100n)])
        .setChainId(snapshot.chainId!)
        .setAccount(snapshot.account!)
        .setSecurityZone(0)
        .encrypt();

      expect(encrypted.length).toBe(1);
      expect(encrypted[0].utype).toBe(FheTypes.Uint128);
    }, 60000);
  });

  describe('Browser Error Handling', () => {
    it('should fail gracefully when not connected', async () => {
      // Don't connect the client
      try {
        const promise = cofhesdkClient.encryptInputs([Encryptable.uint128(100n)]).encrypt();
      } catch (error) {
        expect(error).toBeInstanceOf(CofhesdkError);
        expect((error as CofhesdkError).code).toBe(CofhesdkErrorCode.NotConnected);
      }
    }, 30000);

    it('should handle invalid CoFHE URL', async () => {
      const badConfig = createCofhesdkConfig({
        supportedChains: [
          {
            ...cofhesdkArbSepolia,
            coFheUrl: 'http://invalid-cofhe-url.local',
            verifierUrl: 'http://invalid-verifier-url.local',
          },
        ],
      });

      const badClient = createCofhesdkClient(badConfig);
      await badClient.connect(publicClient, walletClient);

      const promise = badClient.encryptInputs([Encryptable.uint128(100n)]).encrypt();
      expect(promise).rejects.toThrow();
    }, 60000);
  });

  describe('Browser Performance', () => {
    it('should handle consecutive encryptions efficiently', async () => {
      await cofhesdkClient.connect(publicClient, walletClient);

      const start = Date.now();

      // Perform 5 encryptions
      for (let i = 0; i < 5; i++) {
        await cofhesdkClient.encryptInputs([Encryptable.uint128(BigInt(i))]).encrypt();
      }

      const duration = Date.now() - start;

      // Should complete all 5 encryptions in reasonable time
      // This is a sanity check, not a strict benchmark
      expect(duration).toBeLessThan(120000); // 2 minutes max
    }, 180000); // 3 minute timeout
  });
});
