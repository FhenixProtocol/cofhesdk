import { type CofhesdkClient, CofhesdkError, CofhesdkErrorCode } from '@/core';
import { arbSepolia as cofhesdkArbSepolia } from '@/chains';

import { describe, it, expect, beforeAll, beforeEach, vi } from 'vitest';
import type { PublicClient, WalletClient } from 'viem';
import { createPublicClient, createWalletClient, http } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { arbitrumSepolia as viemArbitrumSepolia } from 'viem/chains';
import { createCofhesdkClient, createCofhesdkConfig } from './index.js';

// Real test setup - no mocks
const TEST_PRIVATE_KEY = '0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80';
const TEST_ACCOUNT = privateKeyToAccount(TEST_PRIVATE_KEY).address;

describe('@cofhe/node - Client Integration Tests', () => {
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

  describe('Real Client Initialization', () => {
    it('should create a client with real node-tfhe', () => {
      expect(cofhesdkClient).toBeDefined();
      expect(cofhesdkClient.config).toBeDefined();
      expect(cofhesdkClient.connected).toBe(false);
    });

    it('should automatically use filesystem storage as default', () => {
      expect(cofhesdkClient.config.fheKeyStorage).toBeDefined();
      expect(cofhesdkClient.config.fheKeyStorage).not.toBeNull();
    });

    it('should have all expected methods', () => {
      expect(typeof cofhesdkClient.connect).toBe('function');
      expect(typeof cofhesdkClient.encryptInputs).toBe('function');
      expect(typeof cofhesdkClient.decryptHandle).toBe('function');
      expect(typeof cofhesdkClient.getSnapshot).toBe('function');
      expect(typeof cofhesdkClient.subscribe).toBe('function');
    });
  });

  describe('Real Connection', () => {
    it('should connect to real chain', async () => {
      const result = await cofhesdkClient.connect(publicClient, walletClient);

      expect(cofhesdkClient.connected).toBe(true);

      const snapshot = cofhesdkClient.getSnapshot();
      expect(snapshot.connected).toBe(true);
      expect(snapshot.chainId).toBe(cofhesdkArbSepolia.id);
      expect(snapshot.account).toBe(TEST_ACCOUNT);
    }, 30000);

    it('should handle real network errors', async () => {
      try {
        await cofhesdkClient.connect(
          {
            getChainId: vi.fn().mockRejectedValue(new Error('Network error')),
          } as unknown as PublicClient,
          walletClient
        );
      } catch (error) {
        expect(error).toBeInstanceOf(CofhesdkError);
        expect((error as CofhesdkError).code).toBe(CofhesdkErrorCode.PublicWalletGetChainIdFailed);
      }
    }, 30000);
  });

  describe('State Management', () => {
    it('should track connection state changes', async () => {
      const states: any[] = [];
      const unsubscribe = cofhesdkClient.subscribe((snapshot) => {
        states.push({ ...snapshot });
      });

      await cofhesdkClient.connect(publicClient, walletClient);

      unsubscribe();

      expect(states.length).toBeGreaterThan(0);

      // First state should be connecting
      const firstState = states.find((s) => s.connecting);
      expect(firstState).toBeDefined();
      expect(firstState?.connecting).toBe(true);
      expect(firstState?.connected).toBe(false);

      // Last state should be connected
      const lastState = states[states.length - 1];
      expect(lastState.connected).toBe(true);
      expect(lastState.connecting).toBe(false);
      expect(lastState.chainId).toBe(cofhesdkArbSepolia.id);
    }, 30000);
  });

  describe('Builder Creation', () => {
    it('should create encrypt builder after connection', async () => {
      await cofhesdkClient.connect(publicClient, walletClient);

      const builder = cofhesdkClient.encryptInputs([{ data: 100n, utype: 2 }]);

      expect(builder).toBeDefined();
      expect(typeof builder.setChainId).toBe('function');
      expect(typeof builder.setAccount).toBe('function');
      expect(typeof builder.setSecurityZone).toBe('function');
      expect(typeof builder.encrypt).toBe('function');
    }, 30000);

    it('should create decrypt builder after connection', async () => {
      await cofhesdkClient.connect(publicClient, walletClient);

      const builder = cofhesdkClient.decryptHandle(123n, 2);

      expect(builder).toBeDefined();
      expect(typeof builder.setChainId).toBe('function');
      expect(typeof builder.setAccount).toBe('function');
      expect(typeof builder.decrypt).toBe('function');
    }, 30000);
  });
});
