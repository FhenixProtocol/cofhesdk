import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createCofhesdkClient, CofhesdkClient, ConnectStateSnapshot } from './client';
import { createCofhesdkConfig } from './config';
import { CofhesdkErrorCode } from './error';
import type { PublicClient, WalletClient } from 'viem';
import { EncryptInputsBuilder } from './encrypt/encryptInputsBuilder';

// Mock dependencies
vi.mock('./keyStore', () => ({
  keysStorage: {
    rehydrateKeysStore: vi.fn().mockResolvedValue(undefined),
  },
}));

vi.mock('./fetchKeys', () => ({
  fetchMultichainKeys: vi.fn().mockResolvedValue(undefined),
}));

// Test helpers
const createMockPublicClient = (chainId = 11155111): PublicClient =>
  ({
    getChainId: vi.fn().mockResolvedValue(chainId),
  }) as any;

const createMockWalletClient = (addresses = ['0x1234567890123456789012345678901234567890']): WalletClient =>
  ({
    getAddresses: vi.fn().mockResolvedValue(addresses),
  }) as any;

const createTestClient = (): CofhesdkClient => {
  const config = createCofhesdkConfig({ supportedChains: [] });
  return createCofhesdkClient({
    config,
    zkBuilderAndCrsGenerator: {} as any,
    tfhePublicKeySerializer: {} as any,
    compactPkeCrsSerializer: {} as any,
  });
};

describe('createCofhesdkClient', () => {
  let client: CofhesdkClient;

  beforeEach(() => {
    client = createTestClient();
  });

  describe('initial state', () => {
    it('should start disconnected', () => {
      const snapshot = client.getSnapshot();
      expect(snapshot.connected).toBe(false);
      expect(snapshot.connecting).toBe(false);
      expect(snapshot.connectError).toBe(null);
      expect(snapshot.chainId).toBe(null);
      expect(snapshot.address).toBe(null);
    });

    it('should expose convenience flags', () => {
      expect(client.connected).toBe(false);
      expect(client.connecting).toBe(false);
    });

    it('should expose config', () => {
      expect(client.config).toBeDefined();
      expect(client.config.supportedChains).toEqual([]);
    });
  });

  describe('reactive state', () => {
    it('should notify subscribers of state changes', async () => {
      const states: ConnectStateSnapshot[] = [];
      client.subscribe((snapshot) => states.push(snapshot));

      const publicClient = createMockPublicClient();
      const walletClient = createMockWalletClient();
      await client.connect(publicClient, walletClient);

      // Expect states[0] to be the connecting state
      expect(states[0].connecting).toBe(true);
      expect(states[0].connected).toBe(false);
      expect(states[0].chainId).toBe(null);
      expect(states[0].address).toBe(null);

      // Expect states[1] to be the connected state
      expect(states[1].connected).toBe(true);
      expect(states[1].connecting).toBe(false);
      expect(states[1].chainId).toBe(11155111);
      expect(states[1].address).toBe('0x1234567890123456789012345678901234567890');
    });

    it('should stop notifications after unsubscribe', async () => {
      const states: ConnectStateSnapshot[] = [];
      const unsubscribe = client.subscribe((snapshot) => states.push(snapshot));

      unsubscribe();

      const publicClient = createMockPublicClient();
      const walletClient = createMockWalletClient();
      await client.connect(publicClient, walletClient);

      // Should only have the initial notification
      expect(states.length).toBe(0);
    });
  });

  describe('connect', () => {
    it('should successfully connect with valid clients', async () => {
      const publicClient = createMockPublicClient(11155111);
      const walletClient = createMockWalletClient(['0xabcd']);

      const result = await client.connect(publicClient, walletClient);

      expect(result.success).toBe(true);
      expect(result.data).toBe(true);
      expect(client.connected).toBe(true);
      expect(client.connecting).toBe(false);

      const snapshot = client.getSnapshot();
      expect(snapshot.chainId).toBe(11155111);
      expect(snapshot.address).toBe('0xabcd');
    });

    it('should set connecting state during connection', async () => {
      const publicClient = createMockPublicClient();
      const walletClient = createMockWalletClient();

      const connectPromise = client.connect(publicClient, walletClient);

      // Check mid-connection state
      expect(client.connecting).toBe(true);
      expect(client.connected).toBe(false);

      await connectPromise;

      expect(client.connecting).toBe(false);
      expect(client.connected).toBe(true);
    });

    it('should return existing promise if already connecting', async () => {
      const publicClient = createMockPublicClient();
      const walletClient = createMockWalletClient();

      const promise1 = client.connect(publicClient, walletClient);
      const promise2 = client.connect(publicClient, walletClient);

      expect(promise1).toStrictEqual(promise2);

      await promise1;
    });

    it('should return immediately if already connected with same clients', async () => {
      const publicClient = createMockPublicClient();
      const walletClient = createMockWalletClient();

      await client.connect(publicClient, walletClient);
      const result = await client.connect(publicClient, walletClient);

      expect(result.success).toBe(true);
    });

    it('should handle getChainId throwing an error', async () => {
      const publicClient = createMockPublicClient();
      const error = new Error('Network error');
      publicClient.getChainId = vi.fn().mockRejectedValue(error);
      const walletClient = createMockWalletClient();

      const result = await client.connect(publicClient, walletClient);

      expect(result.success).toBe(false);
      expect(result.error?.code).toBe(CofhesdkErrorCode.PublicWalletGetChainIdFailed);
      expect(result.error?.message).toBe('connect(): publicClient.getChainId() failed');
      expect(result.error?.cause).toBe(error);
      expect(client.connected).toBe(false);
    });

    it('should handle getChainId returning null', async () => {
      const publicClient = createMockPublicClient();
      publicClient.getChainId = vi.fn().mockResolvedValue(null);
      const walletClient = createMockWalletClient();

      const result = await client.connect(publicClient, walletClient);

      expect(result.success).toBe(false);
      expect(result.error?.code).toBe(CofhesdkErrorCode.PublicWalletGetChainIdFailed);
      expect(result.error?.message).toBe('connect(): publicClient.getChainId() returned null');
      expect(result.error?.cause).toBe(undefined);
      expect(client.connected).toBe(false);
    });

    it('should handle getAddresses throwing an error', async () => {
      const publicClient = createMockPublicClient();
      const error = new Error('Network error');
      const walletClient = createMockWalletClient();
      walletClient.getAddresses = vi.fn().mockRejectedValue(error);

      const result = await client.connect(publicClient, walletClient);

      expect(result.success).toBe(false);
      expect(result.error?.code).toBe(CofhesdkErrorCode.PublicWalletGetAddressesFailed);
      expect(result.error?.message).toBe('connect(): walletClient.getAddresses() failed');
      expect(result.error?.cause).toBe(error);
      expect(client.connected).toBe(false);
    });

    it('should handle getAddresses returning an empty array', async () => {
      const publicClient = createMockPublicClient();
      const walletClient = createMockWalletClient([]);

      const result = await client.connect(publicClient, walletClient);

      expect(result.success).toBe(false);
      expect(result.error?.code).toBe(CofhesdkErrorCode.PublicWalletGetAddressesFailed);
      expect(result.error?.message).toBe('connect(): walletClient.getAddresses() returned an empty array');
      expect(result.error?.cause).toBe(undefined);
      expect(client.connected).toBe(false);
    });

    it('should store error in state on failure', async () => {
      const publicClient = createMockPublicClient();
      const error = new Error('Network error');
      publicClient.getChainId = vi.fn().mockRejectedValue(error);
      const walletClient = createMockWalletClient();

      const result = await client.connect(publicClient, walletClient);

      expect(result.success).toBe(false);
      const snapshot = client.getSnapshot();
      expect(snapshot.connectError).toBeTruthy();
      expect(snapshot.connected).toBe(false);
    });
  });

  describe('encryptInputs', () => {
    it('should throw if not connected', async () => {
      const result = await client.encryptInputs([1, 2, 3]).encrypt();
      expect(result.success).toBe(false);
      expect(result.error?.code).toBe(CofhesdkErrorCode.SenderUninitialized);
    });

    it('should create EncryptInputsBuilder when connected', async () => {
      const publicClient = createMockPublicClient(123);
      const walletClient = createMockWalletClient(['0xtest']);

      await client.connect(publicClient, walletClient);

      const builder = await client.encryptInputs([1, 2, 3]);

      expect(builder).toBeDefined();
      expect(builder).toBeInstanceOf(EncryptInputsBuilder);
      expect(builder).toHaveProperty('encrypt');
      expect(builder.getChainId()).toBe(123);
      expect(builder.getSender()).toBe('0xtest');
    });
  });

  describe('initializationResults', () => {
    it('should have keyFetchResult promise', () => {
      expect(client.initializationResults.keyFetchResult).toBeInstanceOf(Promise);
    });

    it('should resolve keyFetchResult', async () => {
      const result = await client.initializationResults.keyFetchResult;
      expect(result.success).toBe(true);
    });
  });

  describe('permits', () => {
    it('should expose permits', () => {
      expect(client.permits).toBeDefined();
      expect(client.permits).toHaveProperty('getSnapshot');
      expect(client.permits).toHaveProperty('subscribe');
      expect(client.permits).toHaveProperty('createSelf');
      expect(client.permits).toHaveProperty('createSharing');
      expect(client.permits).toHaveProperty('importShared');
      expect(client.permits).toHaveProperty('getHash');
      expect(client.permits).toHaveProperty('serialize');
      expect(client.permits).toHaveProperty('deserialize');
      expect(client.permits).toHaveProperty('getPermit');
      expect(client.permits).toHaveProperty('getPermits');
      expect(client.permits).toHaveProperty('getActivePermit');
      expect(client.permits).toHaveProperty('getActivePermitHash');
      expect(client.permits).toHaveProperty('removePermit');
      expect(client.permits).toHaveProperty('selectActivePermit');
      expect(client.permits).toHaveProperty('removeActivePermit');
    });
  });
});
