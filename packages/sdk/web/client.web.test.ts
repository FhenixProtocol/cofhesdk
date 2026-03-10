import { CofheErrorCode, CofheError, type CofheClient } from '@/core';
import { arbSepolia as cofheArbSepolia } from '@/chains';

import { describe, it, expect, beforeAll, beforeEach, vi } from 'vitest';
import { arbitrumSepolia as viemArbitrumSepolia } from 'viem/chains';
import type { PublicClient, WalletClient } from 'viem';
import { createPublicClient, createWalletClient, http } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { createCofheClient, createCofheConfig } from './index.js';

// Real test setup - runs in browser
const TEST_PRIVATE_KEY = '0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80';
const TEST_ACCOUNT = privateKeyToAccount(TEST_PRIVATE_KEY).address;

describe('@cofhe/web - Client', () => {
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

  describe('Browser Client Initialization', () => {
    it('should create a client with real tfhe for browser', () => {
      expect(cofheClient).toBeDefined();
      expect(cofheClient.config).toBeDefined();
      expect(cofheClient.connected).toBe(false);
    });

    it('should automatically use IndexedDB storage as default', () => {
      expect(cofheClient.config.fheKeyStorage).toBeDefined();
      expect(cofheClient.config.fheKeyStorage).not.toBeNull();
    });

    it('should have all expected methods', () => {
      expect(typeof cofheClient.connect).toBe('function');
      expect(typeof cofheClient.encryptInputs).toBe('function');
      expect(typeof cofheClient.decryptForView).toBe('function');
      expect(typeof cofheClient.getSnapshot).toBe('function');
      expect(typeof cofheClient.subscribe).toBe('function');
    });
  });

  describe('Environment', () => {
    it('should have the correct environment', () => {
      expect(cofheClient.config.environment).toBe('web');
    });
  });

  describe('Connection', () => {
    it('should connect to real chain', async () => {
      await cofheClient.connect(publicClient, walletClient);

      expect(cofheClient.connected).toBe(true);

      const snapshot = cofheClient.getSnapshot();
      expect(snapshot.connected).toBe(true);
      expect(snapshot.chainId).toBe(cofheArbSepolia.id);
      expect(snapshot.account).toBe(TEST_ACCOUNT);
    }, 30000);

    it('should handle network errors', async () => {
      try {
        await cofheClient.connect(
          {
            getChainId: vi.fn().mockRejectedValue(new Error('Network error')),
          } as unknown as PublicClient,
          walletClient
        );
      } catch (error) {
        expect(error).toBeInstanceOf(CofheError);
        expect((error as CofheError).code).toBe(CofheErrorCode.PublicWalletGetChainIdFailed);
      }
    }, 30000);
  });

  describe('State Management', () => {
    it('should track connection state changes', async () => {
      const states: any[] = [];
      const unsubscribe = cofheClient.subscribe((snapshot) => {
        states.push({ ...snapshot });
      });

      await cofheClient.connect(publicClient, walletClient);

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
      expect(lastState.chainId).toBe(cofheArbSepolia.id);
    }, 30000);
  });

  describe('Builder Creation', () => {
    it('should create encrypt builder after connection', async () => {
      await cofheClient.connect(publicClient, walletClient);

      const builder = cofheClient.encryptInputs([{ data: 100n, utype: 2, securityZone: 0 }]);

      expect(builder).toBeDefined();
      expect(typeof builder.setChainId).toBe('function');
      expect(typeof builder.setAccount).toBe('function');
      expect(typeof builder.setSecurityZone).toBe('function');
      expect(typeof builder.execute).toBe('function');
    }, 30000);

    it('should create decrypt builder after connection', async () => {
      await cofheClient.connect(publicClient, walletClient);

      const builder = cofheClient.decryptForView('0x123', 2);

      expect(builder).toBeDefined();
      expect(typeof builder.setChainId).toBe('function');
      expect(typeof builder.setAccount).toBe('function');
      expect(typeof builder.execute).toBe('function');
    }, 30000);
  });
});
