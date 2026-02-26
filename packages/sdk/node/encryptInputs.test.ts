import { Encryptable, FheTypes, type CofheClient, CofheErrorCode, CofheError } from '@/core';
import { arbSepolia as cofheArbSepolia } from '@/chains';

import { describe, it, expect, beforeAll, beforeEach } from 'vitest';
import type { PublicClient, WalletClient } from 'viem';
import { createPublicClient, createWalletClient, http } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { arbitrumSepolia as viemArbitrumSepolia } from 'viem/chains';
import { createCofheClient, createCofheConfig } from './index.js';

// Real test setup - using actual node-tfhe
const TEST_PRIVATE_KEY = '0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80';

describe('@cofhe/node - Encrypt Inputs', () => {
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

  describe('Real TFHE Initialization', () => {
    it('should initialize node-tfhe on first encryption', async () => {
      await cofheClient.connect(publicClient, walletClient);

      // This will trigger real TFHE initialization
      const encrypted = await cofheClient.encryptInputs([Encryptable.uint128(100n)]).execute();

      // If we get here, TFHE was initialized successfully
      expect(encrypted).toBeDefined();
    }, 60000); // Longer timeout for real operations

    it('should handle multiple encryptions without re-initializing', async () => {
      await cofheClient.connect(publicClient, walletClient);

      // First encryption
      await cofheClient.encryptInputs([Encryptable.uint128(100n)]).execute();

      // Second encryption should reuse initialization
      await cofheClient.encryptInputs([Encryptable.uint64(50n)]).execute();
    }, 120000);
  });

  describe('Real Encryption', () => {
    it('should encrypt a bool with real TFHE', async () => {
      await cofheClient.connect(publicClient, walletClient);

      const encrypted = await cofheClient.encryptInputs([Encryptable.bool(true)]).execute();

      expect(encrypted.length).toBe(1);
      expect(encrypted[0].utype).toBe(FheTypes.Bool);
      expect(encrypted[0].ctHash).toBeDefined();
      expect(typeof encrypted[0].ctHash).toBe('bigint');
      expect(encrypted[0].signature).toBeDefined();
      expect(typeof encrypted[0].signature).toBe('string');
      expect(encrypted[0].securityZone).toBe(0);
    }, 60000);

    it('should encrypt all supported types together', async () => {
      await cofheClient.connect(publicClient, walletClient);

      const inputs = [
        Encryptable.bool(false),
        Encryptable.uint8(1n),
        Encryptable.uint16(2n),
        Encryptable.uint32(3n),
        Encryptable.uint64(4n),
        Encryptable.uint128(5n),
        Encryptable.address('0x742d35Cc6634C0532925a3b844D16faC4c175E99'),
      ];

      const encrypted = await cofheClient.encryptInputs(inputs).execute();

      expect(encrypted.length).toBe(7);
      // Verify each type
      expect(encrypted[0].utype).toBe(FheTypes.Bool);
      expect(encrypted[1].utype).toBe(FheTypes.Uint8);
      expect(encrypted[2].utype).toBe(FheTypes.Uint16);
      expect(encrypted[3].utype).toBe(FheTypes.Uint32);
      expect(encrypted[4].utype).toBe(FheTypes.Uint64);
      expect(encrypted[5].utype).toBe(FheTypes.Uint128);
      expect(encrypted[6].utype).toBe(FheTypes.Uint160);
    }, 90000); // Longer timeout for multiple encryptions
  });

  describe('Real Builder Pattern', () => {
    it('should support chaining builder methods with real encryption', async () => {
      await cofheClient.connect(publicClient, walletClient);

      const snapshot = cofheClient.getSnapshot();
      const encrypted = await cofheClient
        .encryptInputs([Encryptable.uint128(100n)])
        .setChainId(snapshot.chainId!)
        .setAccount(snapshot.account!)
        .setSecurityZone(0)
        .execute();

      expect(encrypted.length).toBe(1);
      expect(encrypted[0].utype).toBe(FheTypes.Uint128);
    }, 60000);
  });

  describe('Real Error Handling', () => {
    it('should fail gracefully when not connected', async () => {
      // Don't connect the client
      try {
        await cofheClient.encryptInputs([Encryptable.uint128(100n)]).execute();
      } catch (error) {
        expect(error).toBeInstanceOf(CofheError);
        expect((error as CofheError).code).toBe(CofheErrorCode.NotConnected);
      }
    }, 30000);

    it('should handle invalid CoFHE URL', async () => {
      const badConfig = createCofheConfig({
        supportedChains: [
          {
            ...cofheArbSepolia,
            coFheUrl: 'http://invalid-cofhe-url.local',
            verifierUrl: 'http://invalid-verifier-url.local',
          },
        ],
      });

      const badClient = createCofheClient(badConfig);
      await badClient.connect(publicClient, walletClient);

      try {
        await badClient.encryptInputs([Encryptable.uint128(100n)]).execute();
      } catch (error) {
        expect(error).toBeInstanceOf(CofheError);
        expect((error as CofheError).code).toBe(CofheErrorCode.ZkVerifyFailed);
      }
    }, 60000);
  });
});
