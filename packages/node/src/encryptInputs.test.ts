import { describe, it, expect, beforeAll, beforeEach } from 'vitest';
import { createCofhesdkClient, createCofhesdkConfig } from './index';
import { Encryptable, FheTypes, CofhesdkClient, Result, CofhesdkErrorCode, CofhesdkError } from '@cofhesdk/core';
import type { PublicClient, WalletClient } from 'viem';
import { createPublicClient, createWalletClient, http } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { arbSepolia as cofhesdkArbSepolia } from '@cofhesdk/chains';
import { arbitrumSepolia as viemArbitrumSepolia } from 'viem/chains';

// Real test setup - using actual node-tfhe
const TEST_PRIVATE_KEY = '0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80';

const expectResultSuccess = <T>(result: Result<T>): T => {
  expect(result.success, `Result error: ${result.error?.toString()}`).toBe(true);
  return result.data!;
};

const expectResultError = <T>(result: Result<T>, errorCode?: CofhesdkErrorCode): void => {
  expect(result.success).toBe(false);
  expect(result.data).toBe(null);
  expect(result.error).not.toBe(null);
  const error = result.error as CofhesdkError;
  expect(error).toBeInstanceOf(CofhesdkError);
  if (errorCode) {
    expect(error.code, `Result error: ${result.error?.toString()}`).toBe(errorCode);
  }
};

describe('@cofhesdk/node - Encrypt Inputs', () => {
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

  describe('Real TFHE Initialization', () => {
    it('should initialize node-tfhe on first encryption', async () => {
      await cofhesdkClient.connect(publicClient, walletClient);

      // This will trigger real TFHE initialization
      const result = await cofhesdkClient.encryptInputs([Encryptable.uint128(100n)]).encrypt();
      const encrypted = expectResultSuccess(result);

      // If we get here, TFHE was initialized successfully
      expect(encrypted).toBeDefined();
    }, 60000); // Longer timeout for real operations

    it('should handle multiple encryptions without re-initializing', async () => {
      await cofhesdkClient.connect(publicClient, walletClient);

      // First encryption
      const result1 = await cofhesdkClient.encryptInputs([Encryptable.uint128(100n)]).encrypt();
      expectResultSuccess(result1);

      // Second encryption should reuse initialization
      const result2 = await cofhesdkClient.encryptInputs([Encryptable.uint64(50n)]).encrypt();
      expectResultSuccess(result2);
    }, 60000);
  });

  describe('Real Encryption', () => {
    it('should encrypt a bool with real TFHE', async () => {
      await cofhesdkClient.connect(publicClient, walletClient);

      const result = await cofhesdkClient.encryptInputs([Encryptable.bool(true)]).encrypt();
      const encrypted = expectResultSuccess(result);

      expect(encrypted.length).toBe(1);
      expect(encrypted[0].utype).toBe(FheTypes.Bool);
      expect(encrypted[0].ctHash).toBeDefined();
      expect(typeof encrypted[0].ctHash).toBe('bigint');
      expect(encrypted[0].signature).toBeDefined();
      expect(typeof encrypted[0].signature).toBe('string');
      expect(encrypted[0].securityZone).toBe(0);
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
      const encrypted = expectResultSuccess(result);

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
      await cofhesdkClient.connect(publicClient, walletClient);

      const snapshot = cofhesdkClient.getSnapshot();
      const result = await cofhesdkClient
        .encryptInputs([Encryptable.uint128(100n)])
        .setChainId(snapshot.chainId!)
        .setAccount(snapshot.account!)
        .setSecurityZone(0)
        .encrypt();

      const encrypted = expectResultSuccess(result);
      expect(encrypted.length).toBe(1);
      expect(encrypted[0].utype).toBe(FheTypes.Uint128);
    }, 60000);
  });

  describe('Real Error Handling', () => {
    it('should fail gracefully when not connected', async () => {
      // Don't connect the client
      const result = await cofhesdkClient.encryptInputs([Encryptable.uint128(100n)]).encrypt();

      expectResultError(result, CofhesdkErrorCode.NotConnected);
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
        fheKeysPrefetching: 'OFF',
      });

      const badClient = createCofhesdkClient(badConfig);
      await badClient.connect(publicClient, walletClient);

      const result = await badClient.encryptInputs([Encryptable.uint128(100n)]).encrypt();

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toBeDefined();
      }
    }, 60000);
  });
});
