import { describe, it, expect } from 'vitest';
import { type PublicClient, type WalletClient, createPublicClient, createWalletClient, http } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { arbitrumSepolia } from 'viem/chains';
import { DecryptForTxBuilder } from '../decrypt/decryptForTxBuilder.js';
import { DecryptForViewBuilder } from '../decrypt/decryptForViewBuilder.js';
import { createCofheConfigBase, type CofheConfig } from '../config.js';
import { CofheErrorCode } from '../error.js';
import { FheTypes } from '../types.js';

const TEST_PRIVATE_KEY = '0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80';
const account = privateKeyToAccount(TEST_PRIVATE_KEY);
const TEST_CHAIN_ID = 421614;
const TEST_CT_HASH = '0xabcdef1234567890';

const MockCoFheUrl = 'http://localhost:3001';

const publicClient: PublicClient = createPublicClient({
  chain: arbitrumSepolia,
  transport: http(),
});

const walletClient: WalletClient = createWalletClient({
  chain: arbitrumSepolia,
  transport: http(),
  account,
});

const mockConfig: CofheConfig = createCofheConfigBase({
  supportedChains: [
    {
      id: TEST_CHAIN_ID,
      name: 'Mock Chain',
      network: 'Mock Network',
      coFheUrl: MockCoFheUrl,
      thresholdNetworkUrl: MockCoFheUrl,
      environment: 'TESTNET',
      verifierUrl: MockCoFheUrl,
    },
  ],
});

function createTxBuilder(overrides?: Partial<{ chainId: number; account: string; ctHash: string | bigint }>) {
  return new DecryptForTxBuilder({
    config: mockConfig,
    publicClient,
    walletClient,
    chainId: TEST_CHAIN_ID,
    account: account.address,
    ctHash: TEST_CT_HASH,
    requireConnected: undefined,
    ...overrides,
  });
}

function createViewBuilder<U extends FheTypes>(
  utype: U,
  overrides?: Partial<{ chainId: number; account: string; ctHash: string | bigint }>
) {
  return new DecryptForViewBuilder<U>({
    config: mockConfig,
    publicClient,
    walletClient,
    chainId: TEST_CHAIN_ID,
    account: account.address,
    ctHash: TEST_CT_HASH,
    utype,
    requireConnected: undefined,
    ...overrides,
  });
}

// ---------------------------------------------------------------------------
// DecryptForTxBuilder
// ---------------------------------------------------------------------------

describe('DecryptForTxBuilder', () => {
  // --- setChainId / getChainId ---

  describe('setChainId / getChainId', () => {
    it('should store and return the chainId', () => {
      const builder = createTxBuilder({ chainId: undefined });
      expect(builder.getChainId()).toBeUndefined();

      builder.setChainId(11155111);
      expect(builder.getChainId()).toBe(11155111);
    });

    it('should allow overriding', () => {
      const builder = createTxBuilder({ chainId: 1 });
      builder.setChainId(42);
      expect(builder.getChainId()).toBe(42);
    });
  });

  // --- setAccount / getAccount ---

  describe('setAccount / getAccount', () => {
    it('should store and return the account', () => {
      const builder = createTxBuilder({ account: undefined });
      expect(builder.getAccount()).toBeUndefined();

      builder.setAccount('0xdeadbeef');
      expect(builder.getAccount()).toBe('0xdeadbeef');
    });

    it('should allow overriding', () => {
      const builder = createTxBuilder();
      builder.setAccount('0xnewaccount');
      expect(builder.getAccount()).toBe('0xnewaccount');
    });
  });

  // --- withPermit / withoutPermit selection ---

  describe('withPermit / withoutPermit selection', () => {
    it('withPermit() should set permit selection', () => {
      const builder = createTxBuilder();
      const selected = builder.withPermit();
      expect(selected).toBeDefined();
      expect(selected.getPermit()).toBeUndefined();
      expect(selected.getPermitHash()).toBeUndefined();
    });

    it('withPermit(hash) should store the permit hash', () => {
      const builder = createTxBuilder();
      const selected = builder.withPermit('0xmypermithash');
      expect(selected.getPermitHash()).toBe('0xmypermithash');
      expect(selected.getPermit()).toBeUndefined();
    });

    it('withoutPermit() should set permit selection', () => {
      const builder = createTxBuilder();
      const selected = builder.withoutPermit();
      expect(selected).toBeDefined();
      expect(selected.getPermit()).toBeUndefined();
      expect(selected.getPermitHash()).toBeUndefined();
    });

    it('should throw when withPermit() is called twice', () => {
      const builder = createTxBuilder();
      builder.withPermit();

      expect(() => (builder as any).withPermit()).toThrow('withPermit() can only be selected once');
    });

    it('should throw when withoutPermit() is called twice', () => {
      const builder = createTxBuilder();
      builder.withoutPermit();

      expect(() => (builder as any).withoutPermit()).toThrow('withoutPermit() can only be selected once');
    });

    it('should throw when withPermit() is called after withoutPermit()', () => {
      const builder = createTxBuilder();
      builder.withoutPermit();

      expect(() => (builder as any).withPermit()).toThrow('cannot call withPermit() after withoutPermit()');
    });

    it('should throw when withoutPermit() is called after withPermit()', () => {
      const builder = createTxBuilder();
      builder.withPermit();

      expect(() => (builder as any).withoutPermit()).toThrow('cannot call withoutPermit() after withPermit()');
    });
  });

  // --- chaining ---

  describe('chaining', () => {
    it('should return the builder from each setter for fluent chaining', () => {
      const builder = createTxBuilder({ chainId: undefined, account: undefined });
      const result = builder.setChainId(TEST_CHAIN_ID).setAccount(account.address).withPermit();

      expect(result).toBeDefined();
      expect(result.getChainId()).toBe(TEST_CHAIN_ID);
      expect(result.getAccount()).toBe(account.address);
    });

    it('should allow setChainId and setAccount after withPermit', () => {
      const builder = createTxBuilder({ chainId: undefined, account: undefined });
      const selected = builder.withPermit();
      selected.setChainId(99);
      selected.setAccount('0xabc');

      expect(selected.getChainId()).toBe(99);
      expect(selected.getAccount()).toBe('0xabc');
    });

    it('should allow setChainId and setAccount after withoutPermit', () => {
      const builder = createTxBuilder({ chainId: undefined, account: undefined });
      const selected = builder.withoutPermit();
      selected.setChainId(99);
      selected.setAccount('0xabc');

      expect(selected.getChainId()).toBe(99);
      expect(selected.getAccount()).toBe('0xabc');
    });
  });

  // --- execute error paths ---

  describe('execute – error paths', () => {
    it('should throw when execute() is called without permit selection', async () => {
      const builder = createTxBuilder();

      try {
        await builder.execute();
        expect.fail('Expected error');
      } catch (error) {
        expect((error as any).code).toBe(CofheErrorCode.InternalError);
        expect((error as Error).message).toContain('missing permit selection');
      }
    });

    it('should throw when withPermit() has no active permit', async () => {
      const builder = createTxBuilder();

      try {
        await builder.withPermit().execute();
        expect.fail('Expected PermitNotFound error');
      } catch (error) {
        expect((error as any).code).toBe(CofheErrorCode.PermitNotFound);
        expect((error as Error).message).toContain('Active permit not found');
      }
    });

    it('should throw when withPermit(hash) cannot find permit', async () => {
      const builder = createTxBuilder();

      try {
        await builder.withPermit('0xnonexistent').execute();
        expect.fail('Expected PermitNotFound error');
      } catch (error) {
        expect((error as any).code).toBe(CofheErrorCode.PermitNotFound);
        expect((error as Error).message).toContain('Permit with hash');
      }
    });
  });

  // --- constructor error paths ---

  describe('constructor – error paths', () => {
    it('should throw when config is undefined', () => {
      expect(
        () =>
          new DecryptForTxBuilder({
            config: undefined,
            publicClient,
            walletClient,
            chainId: TEST_CHAIN_ID,
            account: account.address,
            ctHash: TEST_CT_HASH,
            requireConnected: undefined,
          })
      ).toThrow();
    });
  });
});

// ---------------------------------------------------------------------------
// DecryptForViewBuilder
// ---------------------------------------------------------------------------

describe('DecryptForViewBuilder', () => {
  // --- setChainId / getChainId ---

  describe('setChainId / getChainId', () => {
    it('should store and return the chainId', () => {
      const builder = createViewBuilder(FheTypes.Uint32, { chainId: undefined });
      expect(builder.getChainId()).toBeUndefined();

      builder.setChainId(11155111);
      expect(builder.getChainId()).toBe(11155111);
    });
  });

  // --- setAccount / getAccount ---

  describe('setAccount / getAccount', () => {
    it('should store and return the account', () => {
      const builder = createViewBuilder(FheTypes.Uint32, { account: undefined });
      expect(builder.getAccount()).toBeUndefined();

      builder.setAccount('0xdeadbeef');
      expect(builder.getAccount()).toBe('0xdeadbeef');
    });
  });

  // --- withPermit ---

  describe('withPermit', () => {
    it('withPermit() should clear permit and hash', () => {
      const builder = createViewBuilder(FheTypes.Uint32);
      builder.withPermit();
      expect(builder.getPermit()).toBeUndefined();
      expect(builder.getPermitHash()).toBeUndefined();
    });

    it('withPermit(hash) should store the permit hash', () => {
      const builder = createViewBuilder(FheTypes.Uint32);
      builder.withPermit('0xmypermithash');
      expect(builder.getPermitHash()).toBe('0xmypermithash');
      expect(builder.getPermit()).toBeUndefined();
    });

    it('should allow overriding permit selection', () => {
      const builder = createViewBuilder(FheTypes.Uint32);
      builder.withPermit('0xfirst');
      expect(builder.getPermitHash()).toBe('0xfirst');

      builder.withPermit('0xsecond');
      expect(builder.getPermitHash()).toBe('0xsecond');
    });
  });

  // --- chaining ---

  describe('chaining', () => {
    it('should return the builder from each setter for fluent chaining', () => {
      const builder = createViewBuilder(FheTypes.Uint32, { chainId: undefined, account: undefined });
      const result = builder.setChainId(TEST_CHAIN_ID).setAccount(account.address).withPermit();

      expect(result).toBeDefined();
      expect(result.getChainId()).toBe(TEST_CHAIN_ID);
      expect(result.getAccount()).toBe(account.address);
    });
  });

  // --- execute error paths ---

  describe('execute – error paths', () => {
    it('should throw when active permit is not found', async () => {
      const builder = createViewBuilder(FheTypes.Uint32);

      try {
        await builder.execute();
        expect.fail('Expected PermitNotFound error');
      } catch (error) {
        expect((error as any).code).toBe(CofheErrorCode.PermitNotFound);
        expect((error as Error).message).toContain('Active permit not found');
      }
    });

    it('should throw when withPermit(hash) cannot find permit', async () => {
      const builder = createViewBuilder(FheTypes.Uint32);
      builder.withPermit('0xnonexistent');

      try {
        await builder.execute();
        expect.fail('Expected PermitNotFound error');
      } catch (error) {
        expect((error as any).code).toBe(CofheErrorCode.PermitNotFound);
        expect((error as Error).message).toContain('Permit with hash');
      }
    });

    it('should throw for invalid utype', async () => {
      const builder = createViewBuilder(999 as FheTypes);

      try {
        await builder.execute();
        expect.fail('Expected InvalidUtype error');
      } catch (error) {
        expect((error as any).code).toBe(CofheErrorCode.InvalidUtype);
      }
    });
  });

  // --- constructor error paths ---

  describe('constructor – error paths', () => {
    it('should throw when config is undefined', () => {
      expect(
        () =>
          new DecryptForViewBuilder({
            config: undefined,
            publicClient,
            walletClient,
            chainId: TEST_CHAIN_ID,
            account: account.address,
            ctHash: TEST_CT_HASH,
            utype: FheTypes.Uint32,
            requireConnected: undefined,
          })
      ).toThrow();
    });
  });
});
