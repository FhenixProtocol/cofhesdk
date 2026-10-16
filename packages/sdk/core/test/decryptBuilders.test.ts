import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { type PublicClient, type WalletClient, createPublicClient, createWalletClient, http, zeroAddress } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { arbitrumSepolia } from 'viem/chains';
import { ACPUtils, acpStore, type ACP } from '@/acps';
import { DecryptForTxBuilder } from '../decrypt/decryptForTxBuilder.js';
import { DecryptForViewBuilder } from '../decrypt/decryptForViewBuilder.js';
import { tnDecryptV2 } from '../decrypt/tnDecryptV2';
import { tnSealOutputV2 } from '../decrypt/tnSealOutputV2';
import { createCofheConfigBase, type CofheConfig } from '../config.js';
import { CofheError, CofheErrorCode } from '../error.js';
import { FheTypes } from '../types.js';

// Stub the threshold network calls so tests can assert whether a request was dispatched
vi.mock('../decrypt/tnDecryptV2', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../decrypt/tnDecryptV2')>()),
  tnDecryptV2: vi.fn(),
}));
vi.mock('../decrypt/tnSealOutputV2', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../decrypt/tnSealOutputV2')>()),
  tnSealOutputV2: vi.fn(),
}));

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

function createTxBuilder(
  overrides?: Partial<{ chainId: number | undefined; account: string; ctHash: string | bigint }>
) {
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
  overrides?: Partial<{ chainId: number | undefined; account: string; ctHash: string | bigint }>
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

  // --- withACP / withoutACP selection ---

  describe('withACP / withoutACP selection', () => {
    it('withACP() should set acp selection', () => {
      const builder = createTxBuilder();
      const selected = builder.withACP();
      expect(selected).toBeDefined();
      expect(selected.getACP()).toBeUndefined();
      expect(selected.getACPHash()).toBeUndefined();
    });

    it('withACP(hash) should store the acp hash', () => {
      const builder = createTxBuilder();
      const selected = builder.withACP('0xmyacphash');
      expect(selected.getACPHash()).toBe('0xmyacphash');
      expect(selected.getACP()).toBeUndefined();
    });

    it('withoutACP() should set acp selection', () => {
      const builder = createTxBuilder();
      const selected = builder.withoutACP();
      expect(selected).toBeDefined();
      expect(selected.getACP()).toBeUndefined();
      expect(selected.getACPHash()).toBeUndefined();
    });

    it('should throw when withACP() is called twice', () => {
      const builder = createTxBuilder();
      builder.withACP();

      expect(() => (builder as any).withACP()).toThrow('withACP() can only be selected once');
    });

    it('should throw when withoutACP() is called twice', () => {
      const builder = createTxBuilder();
      builder.withoutACP();

      expect(() => (builder as any).withoutACP()).toThrow('withoutACP() can only be selected once');
    });

    it('should throw when withACP() is called after withoutACP()', () => {
      const builder = createTxBuilder();
      builder.withoutACP();

      expect(() => (builder as any).withACP()).toThrow('cannot call withACP() after withoutACP()');
    });

    it('should throw when withoutACP() is called after withACP()', () => {
      const builder = createTxBuilder();
      builder.withACP();

      expect(() => (builder as any).withoutACP()).toThrow('cannot call withoutACP() after withACP()');
    });
  });

  // --- chaining ---

  describe('chaining', () => {
    it('should return the builder from each setter for fluent chaining', () => {
      const builder = createTxBuilder({ chainId: undefined, account: undefined });
      const result = builder.setChainId(TEST_CHAIN_ID).setAccount(account.address).withACP();

      expect(result).toBeDefined();
      expect(result.getChainId()).toBe(TEST_CHAIN_ID);
      expect(result.getAccount()).toBe(account.address);
    });

    it('should allow setChainId and setAccount after withACP', () => {
      const builder = createTxBuilder({ chainId: undefined, account: undefined });
      const selected = builder.withACP();
      selected.setChainId(99);
      selected.setAccount('0xabc');

      expect(selected.getChainId()).toBe(99);
      expect(selected.getAccount()).toBe('0xabc');
    });

    it('should allow setChainId and setAccount after withoutACP', () => {
      const builder = createTxBuilder({ chainId: undefined, account: undefined });
      const selected = builder.withoutACP();
      selected.setChainId(99);
      selected.setAccount('0xabc');

      expect(selected.getChainId()).toBe(99);
      expect(selected.getAccount()).toBe('0xabc');
    });

    it('should allow configuring 404 retry timeout', () => {
      const builder = createTxBuilder();
      const result = builder.set404RetryTimeout(15_000);

      expect(result).toBe(builder);
      expect((builder as any).retry404TimeoutMs).toBe(15_000);
    });

    it('should throw for invalid 404 retry timeout', () => {
      const builder = createTxBuilder();

      expect(() => builder.set404RetryTimeout(-1)).toThrow('set404RetryTimeout(timeoutMs) expects');
    });
  });

  // --- execute error paths ---

  describe('execute – error paths', () => {
    it('should throw when execute() is called without acp selection', async () => {
      const builder = createTxBuilder();

      try {
        await builder.execute();
        expect.fail('Expected error');
      } catch (error) {
        expect((error as any).code).toBe(CofheErrorCode.InternalError);
        expect((error as Error).message).toContain('missing acp selection');
      }
    });

    it('should throw when withACP() has no active acp', async () => {
      const builder = createTxBuilder();

      try {
        await builder.withACP().execute();
        expect.fail('Expected ACPNotFound error');
      } catch (error) {
        expect((error as any).code).toBe(CofheErrorCode.ACPNotFound);
        expect((error as Error).message).toContain('Active acp not found');
      }
    });

    it('should throw when withACP(hash) cannot find acp', async () => {
      const builder = createTxBuilder();

      try {
        await builder.withACP('0xnonexistent').execute();
        expect.fail('Expected ACPNotFound error');
      } catch (error) {
        expect((error as any).code).toBe(CofheErrorCode.ACPNotFound);
        expect((error as Error).message).toContain('ACP with hash');
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

  // --- withACP ---

  describe('withACP', () => {
    it('withACP() should clear acp and hash', () => {
      const builder = createViewBuilder(FheTypes.Uint32);
      builder.withACP();
      expect(builder.getACP()).toBeUndefined();
      expect(builder.getACPHash()).toBeUndefined();
    });

    it('withACP(hash) should store the acp hash', () => {
      const builder = createViewBuilder(FheTypes.Uint32);
      builder.withACP('0xmyacphash');
      expect(builder.getACPHash()).toBe('0xmyacphash');
      expect(builder.getACP()).toBeUndefined();
    });

    it('should allow overriding acp selection', () => {
      const builder = createViewBuilder(FheTypes.Uint32);
      builder.withACP('0xfirst');
      expect(builder.getACPHash()).toBe('0xfirst');

      builder.withACP('0xsecond');
      expect(builder.getACPHash()).toBe('0xsecond');
    });
  });

  // --- chaining ---

  describe('chaining', () => {
    it('should return the builder from each setter for fluent chaining', () => {
      const builder = createViewBuilder(FheTypes.Uint32, { chainId: undefined, account: undefined });
      const result = builder.setChainId(TEST_CHAIN_ID).setAccount(account.address).withACP();

      expect(result).toBeDefined();
      expect(result.getChainId()).toBe(TEST_CHAIN_ID);
      expect(result.getAccount()).toBe(account.address);
    });

    it('should allow configuring 404 retry timeout', () => {
      const builder = createViewBuilder(FheTypes.Uint32);
      const result = builder.set404RetryTimeout(12_000);

      expect(result).toBe(builder);
      expect((builder as any).retry404TimeoutMs).toBe(12_000);
    });

    it('should throw for invalid 404 retry timeout', () => {
      const builder = createViewBuilder(FheTypes.Uint32);

      expect(() => builder.set404RetryTimeout(-1)).toThrow('set404RetryTimeout(timeoutMs) expects');
    });
  });

  // --- execute error paths ---

  describe('execute – error paths', () => {
    it('should throw when active acp is not found', async () => {
      const builder = createViewBuilder(FheTypes.Uint32);

      try {
        await builder.execute();
        expect.fail('Expected ACPNotFound error');
      } catch (error) {
        expect((error as any).code).toBe(CofheErrorCode.ACPNotFound);
        expect((error as Error).message).toContain('Active acp not found');
      }
    });

    it('should throw when withACP(hash) cannot find acp', async () => {
      const builder = createViewBuilder(FheTypes.Uint32);
      builder.withACP('0xnonexistent');

      try {
        await builder.execute();
        expect.fail('Expected ACPNotFound error');
      } catch (error) {
        expect((error as any).code).toBe(CofheErrorCode.ACPNotFound);
        expect((error as Error).message).toContain('ACP with hash');
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

// ---------------------------------------------------------------------------
// Expired acp (regression, issue #272)
//
// The getOrCreate* half of #272 is covered in acps.test.ts. These cover the decrypt path:
// execute() must reject an expired acp (ACPUtils.validate) before any request is dispatched
// to the threshold network, however the acp was selected.
// ---------------------------------------------------------------------------

describe('execute – expired acp (regression, issue #272)', () => {
  type Selection = 'active acp' | 'acp hash' | 'acp object';
  const selections: Selection[] = ['active acp', 'acp hash', 'acp object'];

  const now = () => Math.floor(Date.now() / 1000);

  // Built by hand rather than with ACPUtils.sign, which reads the ACL's EIP-712 domain over RPC.
  // validate() only checks that a signature is present, and the threshold network is stubbed.
  function createSignedSelfACP(expiration: number): ACP {
    return {
      ...ACPUtils.createSelf({ name: 'Test Self ACP', issuer: account.address, expiration }),
      issuerSignature: `0x${'11'.repeat(65)}`,
      _signedDomain: { name: 'ACL', version: '1', chainId: TEST_CHAIN_ID, verifyingContract: zeroAddress },
    };
  }

  // Stores the acp and makes it the active acp for the test chain + account
  function seedACP(acp: ACP) {
    acpStore.setACP(TEST_CHAIN_ID, account.address, acp);
    acpStore.setActiveACPHash(TEST_CHAIN_ID, account.address, acp.hash);
  }

  function selectTxACP(selection: Selection, acp: ACP) {
    const builder = createTxBuilder();
    if (selection === 'acp hash') return builder.withACP(acp.hash);
    if (selection === 'acp object') return builder.withACP(acp);
    return builder.withACP();
  }

  function selectViewACP(selection: Selection, acp: ACP) {
    const builder = createViewBuilder(FheTypes.Uint32);
    if (selection === 'acp hash') return builder.withACP(acp.hash);
    if (selection === 'acp object') return builder.withACP(acp);
    return builder.withACP();
  }

  beforeEach(() => {
    acpStore.store.setState({ acps: {}, activeACPHash: {} });
    vi.mocked(tnDecryptV2).mockReset();
    vi.mocked(tnSealOutputV2).mockReset();
  });

  afterEach(() => {
    acpStore.store.setState({ acps: {}, activeACPHash: {} });
  });

  describe('decryptForTx', () => {
    it.each(selections)('rejects an expired acp selected via %s without dispatching', async (selection) => {
      const acp = createSignedSelfACP(now() - 3600);
      seedACP(acp);

      await expect(selectTxACP(selection, acp).execute()).rejects.toThrow('ACP is expired');
      expect(tnDecryptV2).not.toHaveBeenCalled();
    });

    it('dispatches a valid acp (control for the expired cases)', async () => {
      vi.mocked(tnDecryptV2).mockResolvedValue({ decryptedValue: 7n, signature: '0x1234' });
      const acp = createSignedSelfACP(now() + 3600);
      seedACP(acp);

      const result = await selectTxACP('active acp', acp).execute();

      expect(result.decryptedValue).toBe(7n);
      expect(tnDecryptV2).toHaveBeenCalledOnce();
    });
  });

  describe('decryptForView', () => {
    it.each(selections)('rejects an expired acp selected via %s without dispatching', async (selection) => {
      const acp = createSignedSelfACP(now() - 3600);
      seedACP(acp);

      await expect(selectViewACP(selection, acp).execute()).rejects.toThrow('ACP is expired');
      expect(tnSealOutputV2).not.toHaveBeenCalled();
    });

    it('dispatches a valid acp (control for the expired cases)', async () => {
      vi.mocked(tnSealOutputV2).mockRejectedValue(new Error('stubbed threshold network'));
      const acp = createSignedSelfACP(now() + 3600);
      seedACP(acp);

      await expect(selectViewACP('active acp', acp).execute()).rejects.toThrow('stubbed threshold network');
      expect(tnSealOutputV2).toHaveBeenCalledOnce();
    });
  });
});

// ---------------------------------------------------------------------------
// ChainId mismatch
// ---------------------------------------------------------------------------

describe('execute – chainId mismatch', () => {
  const now = () => Math.floor(Date.now() / 1000);

  function createSignedACP(chainId: number): ACP {
    return {
      ...ACPUtils.createSelf({ name: 'Test ACP', issuer: account.address, expiration: now() + 3600 }),
      issuerSignature: `0x${'11'.repeat(65)}`,
      _signedDomain: { name: 'ACL', version: '1', chainId, verifyingContract: zeroAddress },
    };
  }

  beforeEach(() => {
    vi.mocked(tnDecryptV2).mockReset();
    vi.mocked(tnSealOutputV2).mockReset();
  });

  describe('decryptForTx', () => {
    it('throws ChainIdMismatch and prevents dispatch when builder chainId differs from ACP signed chainId', async () => {
      const acp = createSignedACP(11155111);
      const builder = createTxBuilder({ chainId: TEST_CHAIN_ID });

      try {
        await builder.withACP(acp).execute();
        expect.fail('Expected ChainIdMismatch error');
      } catch (error) {
        expect(error).toBeInstanceOf(CofheError);
        expect((error as CofheError).code).toBe(CofheErrorCode.ChainIdMismatch);
        expect((error as CofheError).message).toContain(
          `builder chainId (${TEST_CHAIN_ID}) does not match ACP signed chainId (11155111)`
        );
        expect((error as CofheError).context).toEqual({
          builderChainId: TEST_CHAIN_ID,
          acpChainId: 11155111,
        });
      }
      expect(tnDecryptV2).not.toHaveBeenCalled();
    });

    it('proceeds when builder chainId matches ACP signed chainId', async () => {
      vi.mocked(tnDecryptV2).mockResolvedValue({ decryptedValue: 42n, signature: '0x1234' });
      const acp = createSignedACP(TEST_CHAIN_ID);
      const builder = createTxBuilder({ chainId: TEST_CHAIN_ID });

      const result = await builder.withACP(acp).execute();
      expect(result.decryptedValue).toBe(42n);
      expect(tnDecryptV2).toHaveBeenCalledOnce();
    });

    it('proceeds using ACP signed chainId when builder chainId is unset', async () => {
      vi.mocked(tnDecryptV2).mockResolvedValue({ decryptedValue: 99n, signature: '0x1234' });
      const acp = createSignedACP(TEST_CHAIN_ID);
      const builder = createTxBuilder({ chainId: undefined });

      const result = await builder.withACP(acp).execute();
      expect(result.decryptedValue).toBe(99n);
      expect(tnDecryptV2).toHaveBeenCalledOnce();
    });
  });

  describe('decryptForView', () => {
    it('throws ChainIdMismatch and prevents dispatch when builder chainId differs from ACP signed chainId', async () => {
      const acp = createSignedACP(11155111);
      const builder = createViewBuilder(FheTypes.Uint32, { chainId: TEST_CHAIN_ID });

      try {
        await builder.withACP(acp).execute();
        expect.fail('Expected ChainIdMismatch error');
      } catch (error) {
        expect(error).toBeInstanceOf(CofheError);
        expect((error as CofheError).code).toBe(CofheErrorCode.ChainIdMismatch);
        expect((error as CofheError).message).toContain(
          `builder chainId (${TEST_CHAIN_ID}) does not match ACP signed chainId (11155111)`
        );
        expect((error as CofheError).context).toEqual({
          builderChainId: TEST_CHAIN_ID,
          acpChainId: 11155111,
        });
      }
      expect(tnSealOutputV2).not.toHaveBeenCalled();
    });

    it('proceeds when builder chainId matches ACP signed chainId', async () => {
      vi.mocked(tnSealOutputV2).mockRejectedValue(new Error('stubbed threshold network'));
      const acp = createSignedACP(TEST_CHAIN_ID);
      const builder = createViewBuilder(FheTypes.Uint32, { chainId: TEST_CHAIN_ID });

      await expect(builder.withACP(acp).execute()).rejects.toThrow('stubbed threshold network');
      expect(tnSealOutputV2).toHaveBeenCalledOnce();
    });

    it('proceeds using ACP signed chainId when builder chainId is unset', async () => {
      vi.mocked(tnSealOutputV2).mockRejectedValue(new Error('stubbed threshold network'));
      const acp = createSignedACP(TEST_CHAIN_ID);
      const builder = createViewBuilder(FheTypes.Uint32, { chainId: undefined });

      await expect(builder.withACP(acp).execute()).rejects.toThrow('stubbed threshold network');
      expect(tnSealOutputV2).toHaveBeenCalledOnce();
    });
  });
});
