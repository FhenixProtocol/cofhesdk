import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createCofheClientBase } from './client.js';
import { type CofheClient, type CofheClientConnectionState } from './clientTypes.js';
import { createCofheConfigBase, type CofheEnvironment } from './config.js';
import { CofheError, CofheErrorCode } from './error.js';
import { type PublicClient, type WalletClient } from 'viem';
import { EncryptInputsBuilder } from './encrypt/encryptInputsBuilder.js';
import { Encryptable } from './types.js';

// Mock dependencies
vi.mock('./keyStore', () => ({
  createKeysStore: vi.fn(() => ({
    rehydrateKeysStore: vi.fn().mockResolvedValue(undefined),
    getFheKey: vi.fn(),
    getCrs: vi.fn(),
    setFheKey: vi.fn(),
    setCrs: vi.fn(),
    clearKeysStorage: vi.fn(),
    store: {} as any,
  })),
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

const createTestClient = (): CofheClient => {
  const config = createCofheConfigBase({ supportedChains: [] });
  return createCofheClientBase({
    config,
    zkBuilderAndCrsGenerator: {} as any,
    tfhePublicKeyDeserializer: {} as any,
    compactPkeCrsDeserializer: {} as any,
    initTfhe: () => Promise.resolve(false),
  });
};

describe('createCofheClientBase', () => {
  let client: CofheClient;

  beforeEach(() => {
    client = createTestClient();
  });

  describe('initial state', () => {
    it('should start disconnected', () => {
      const snapshot = client.getSnapshot();
      expect(snapshot.connected).toBe(false);
      expect(snapshot.connecting).toBe(false);
      expect(snapshot.connectError).toBe(undefined);
      expect(snapshot.chainId).toBe(undefined);
      expect(snapshot.account).toBe(undefined);
      expect(snapshot.publicClient).toBe(undefined);
      expect(snapshot.walletClient).toBe(undefined);

      const connection = client.connection;
      expect(connection).toEqual(snapshot);
    });

    it('should expose convenience flags', () => {
      expect(client.connected).toBe(false);
      expect(client.connecting).toBe(false);
      expect(client.connection.connected).toBe(false);
    });

    it('should expose config', () => {
      expect(client.config).toBeDefined();
      expect(client.config.supportedChains).toEqual([]);
    });
  });

  describe('environment', () => {
    it('should create a client with the correct environment', async () => {
      const environments: CofheEnvironment[] = ['node', 'hardhat', 'web', 'react'];
      for (const environment of environments) {
        const config = createCofheConfigBase({ environment, supportedChains: [] });
        const client = createCofheClientBase({
          config,
          zkBuilderAndCrsGenerator: {} as any,
          tfhePublicKeyDeserializer: {} as any,
          compactPkeCrsDeserializer: {} as any,
          initTfhe: () => Promise.resolve(false),
        });

        expect(client.config.environment).toBe(environment);
      }
    });
  });

  describe('reactive state', () => {
    it('should notify subscribers of state changes', async () => {
      const states: CofheClientConnectionState[] = [];
      client.subscribe((snapshot) => states.push(snapshot));

      const publicClient = createMockPublicClient();
      const walletClient = createMockWalletClient();
      await client.connect(publicClient, walletClient);

      // Expect states[0] to be the connecting state
      expect(states[0].connecting).toBe(true);
      expect(states[0].connected).toBe(false);
      expect(states[0].chainId).toBe(undefined);
      expect(states[0].account).toBe(undefined);
      expect(states[0].publicClient).toBe(undefined);
      expect(states[0].walletClient).toBe(undefined);

      // Expect states[1] to be the connected state
      expect(states[1].connected).toBe(true);
      expect(states[1].connecting).toBe(false);
      expect(states[1].chainId).toBe(11155111);
      expect(states[1].account).toBe('0x1234567890123456789012345678901234567890');
      expect(states[1].publicClient).toBe(publicClient);
      expect(states[1].walletClient).toBe(walletClient);
    });

    it('should stop notifications after unsubscribe', async () => {
      const states: CofheClientConnectionState[] = [];
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

      await client.connect(publicClient, walletClient);

      expect(client.connected).toBe(true);
      expect(client.connecting).toBe(false);

      const connection = client.connection;
      expect(connection.chainId).toBe(11155111);
      expect(connection.account).toBe('0xabcd');
      expect(connection.publicClient).toBe(publicClient);
      expect(connection.walletClient).toBe(walletClient);
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

    it('should ensure the latest connection attempt wins when connecting twice', async () => {
      let resolveChainId1: (value: number) => void;
      let resolveAddresses1: (value: string[]) => void;
      let resolveChainId2: (value: number) => void;
      let resolveAddresses2: (value: string[]) => void;

      const chainIdPromise1 = new Promise<number>((resolve) => {
        resolveChainId1 = resolve;
      });
      const addressesPromise1 = new Promise<string[]>((resolve) => {
        resolveAddresses1 = resolve;
      });

      const chainIdPromise2 = new Promise<number>((resolve) => {
        resolveChainId2 = resolve;
      });
      const addressesPromise2 = new Promise<string[]>((resolve) => {
        resolveAddresses2 = resolve;
      });

      const publicClient1 = createMockPublicClient() as any;
      publicClient1.getChainId = vi.fn().mockReturnValue(chainIdPromise1);
      const walletClient1 = createMockWalletClient() as any;
      walletClient1.getAddresses = vi.fn().mockReturnValue(addressesPromise1);

      const publicClient2 = createMockPublicClient() as any;
      publicClient2.getChainId = vi.fn().mockReturnValue(chainIdPromise2);
      const walletClient2 = createMockWalletClient() as any;
      walletClient2.getAddresses = vi.fn().mockReturnValue(addressesPromise2);

      const promise1 = client.connect(publicClient1, walletClient1);
      expect(client.connecting).toBe(true);

      const promise2 = client.connect(publicClient2, walletClient2);

      // Resolve the second connect first
      resolveChainId2!(222);
      resolveAddresses2!(['0x2222222222222222222222222222222222222222']);
      await promise2;

      expect(client.connected).toBe(true);
      expect(client.connecting).toBe(false);
      expect(client.connection.chainId).toBe(222);
      expect(client.connection.account).toBe('0x2222222222222222222222222222222222222222');
      expect(client.connection.publicClient).toBe(publicClient2);
      expect(client.connection.walletClient).toBe(walletClient2);

      // Now resolve the first connect; it must not overwrite the latest state.
      resolveChainId1!(111);
      resolveAddresses1!(['0x1111111111111111111111111111111111111111']);
      await promise1;

      expect(client.connection.chainId).toBe(222);
      expect(client.connection.account).toBe('0x2222222222222222222222222222222222222222');
      expect(client.connection.publicClient).toBe(publicClient2);
      expect(client.connection.walletClient).toBe(walletClient2);
    });

    it('should allow disconnect while connecting and never end up connected afterwards', async () => {
      let resolveChainId: (value: number) => void;
      let resolveAddresses: (value: string[]) => void;

      const chainIdPromise = new Promise<number>((resolve) => {
        resolveChainId = resolve;
      });
      const addressesPromise = new Promise<string[]>((resolve) => {
        resolveAddresses = resolve;
      });

      const publicClient = createMockPublicClient() as any;
      publicClient.getChainId = vi.fn().mockReturnValue(chainIdPromise);

      const walletClient = createMockWalletClient() as any;
      walletClient.getAddresses = vi.fn().mockReturnValue(addressesPromise);

      const connectPromise = client.connect(publicClient, walletClient);
      expect(client.connecting).toBe(true);

      client.disconnect();
      expect(client.connected).toBe(false);
      expect(client.connecting).toBe(false);

      resolveChainId!(11155111);
      resolveAddresses!(['0x1234567890123456789012345678901234567890']);

      await connectPromise;

      expect(client.connected).toBe(false);
      expect(client.connecting).toBe(false);
    });

    it('should handle publicClient.getChainId throwing an error', async () => {
      const publicClient = createMockPublicClient();
      const getChainIdError = new Error('Network error');
      publicClient.getChainId = vi.fn().mockRejectedValue(getChainIdError);
      const walletClient = createMockWalletClient();

      try {
        await client.connect(publicClient, walletClient);
      } catch (error) {
        expect(error).toBeInstanceOf(CofheError);
        expect((error as CofheError).code).toBe(CofheErrorCode.PublicWalletGetChainIdFailed);
        expect((error as CofheError).message).toBe(
          'getting chain ID from public client failed | Caused by: Network error'
        );
        expect((error as CofheError).cause).toBe(getChainIdError);
      }
    });

    it('should handle publicClient.getChainId returning null', async () => {
      const publicClient = createMockPublicClient();
      publicClient.getChainId = vi.fn().mockResolvedValue(null);
      const walletClient = createMockWalletClient();

      const connectPromise = client.connect(publicClient, walletClient);

      try {
        await connectPromise;
      } catch (error) {
        expect(error).toBeInstanceOf(CofheError);
        expect((error as CofheError).code).toBe(CofheErrorCode.PublicWalletGetChainIdFailed);
        expect((error as CofheError).message).toBe('chain ID from public client is null');
      }
    });

    it('should handle walletClient.getAddresses throwing an error', async () => {
      const publicClient = createMockPublicClient();
      const getAddressesError = new Error('Network error');
      const walletClient = createMockWalletClient();
      walletClient.getAddresses = vi.fn().mockRejectedValue(getAddressesError);

      const connectPromise = client.connect(publicClient, walletClient);

      try {
        await connectPromise;
      } catch (error) {
        expect(error).toBeInstanceOf(CofheError);
        expect((error as CofheError).code).toBe(CofheErrorCode.PublicWalletGetAddressesFailed);
        expect((error as CofheError).message).toBe(
          'getting address from wallet client failed | Caused by: Network error'
        );
        expect((error as CofheError).cause).toBe(getAddressesError);
      }
    });

    it('should handle walletClient.getAddresses returning an empty array', async () => {
      const publicClient = createMockPublicClient();
      const walletClient = createMockWalletClient([]);

      const connectPromise = client.connect(publicClient, walletClient);

      try {
        await connectPromise;
      } catch (error) {
        expect(error).toBeInstanceOf(CofheError);
        expect((error as CofheError).code).toBe(CofheErrorCode.PublicWalletGetAddressesFailed);
        expect((error as CofheError).message).toBe('address from wallet client is null');
      }
    });

    it('should store error in state on failure', async () => {
      const publicClient = createMockPublicClient();
      const getChainIdError = new Error('Network error');
      publicClient.getChainId = vi.fn().mockRejectedValue(getChainIdError);
      const walletClient = createMockWalletClient();

      const connectPromise = client.connect(publicClient, walletClient);

      try {
        await connectPromise;
      } catch (error) {
        expect(error).toBeInstanceOf(CofheError);
        expect((error as CofheError).code).toBe(CofheErrorCode.PublicWalletGetChainIdFailed);
        expect((error as CofheError).message).toBe(
          'getting chain ID from public client failed | Caused by: Network error'
        );
        expect((error as CofheError).cause).toBe(getChainIdError);
      }
    });

    it('should disconnect and clear connection state', async () => {
      const publicClient = createMockPublicClient(11155111);
      const walletClient = createMockWalletClient(['0xabcd']);

      await client.connect(publicClient, walletClient);
      expect(client.connected).toBe(true);

      client.disconnect();

      expect(client.connected).toBe(false);
      expect(client.connecting).toBe(false);

      expect(client.connection.chainId).toBe(undefined);
      expect(client.connection.account).toBe(undefined);
      expect(client.connection.publicClient).toBe(undefined);
      expect(client.connection.walletClient).toBe(undefined);
      expect(client.connection.connectError).toBe(undefined);
    });
  });

  describe('encryptInputs', () => {
    it('should throw if not connected', async () => {
      try {
        await client.encryptInputs([Encryptable.uint8(1n), Encryptable.uint8(2n), Encryptable.uint8(3n)]).execute();
      } catch (error) {
        expect(error).toBeInstanceOf(CofheError);
        expect((error as CofheError).code).toBe(CofheErrorCode.NotConnected);
      }
    });

    it('should create EncryptInputsBuilder when connected', async () => {
      const publicClient = createMockPublicClient(123);
      const walletClient = createMockWalletClient(['0xtest']);

      await client.connect(publicClient, walletClient);

      const builder = await client.encryptInputs([Encryptable.uint8(1n), Encryptable.uint8(2n), Encryptable.uint8(3n)]);

      expect(builder).toBeDefined();
      expect(builder).toBeInstanceOf(EncryptInputsBuilder);
      expect(builder).toHaveProperty('execute');
      expect(builder.getChainId()).toBe(123);
      expect(builder.getAccount()).toBe('0xtest');
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
