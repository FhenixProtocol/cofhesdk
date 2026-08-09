import { describe, it, expect, vi } from 'vitest';
import { type PublicClient, type WalletClient, createPublicClient, createWalletClient, http } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { arbitrumSepolia } from 'viem/chains';
import { DecryptForTxBuilder } from '../decrypt/decryptForTxBuilder.js';
import { DecryptForViewBuilder } from '../decrypt/decryptForViewBuilder.js';
import { createCofheConfigBase, type CofheConfig } from '../config.js';
import { CofheErrorCode } from '../error.js';
import { FheTypes } from '../types.js';
import { type EIP712Domain, ACPUtils, SignatureUtils } from '../../acps/index.js';

const TEST_PRIVATE_KEY = '0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80';
const account = privateKeyToAccount(TEST_PRIVATE_KEY);
const TEST_CHAIN_ID = 421614;
const TEST_CT_HASH = '0xabcdef1234567890';

const MockCoFheUrl = 'http://localhost:3001';

async function createSignedTestACP() {
  const acp = ACPUtils.createSelf({
    issuer: account.address,
    name: 'Decrypt Builder Test ACP',
  });
  const domain = {
    chainId: TEST_CHAIN_ID,
    name: 'ACL',
    version: '1',
    verifyingContract: '0x0000000000000000000000000000000000000001',
  } satisfies EIP712Domain;
  const primaryType = SignatureUtils.getPrimaryType(acp.type);
  const { types, message } = SignatureUtils.getSignatureParams(ACPUtils.getPublic(acp, true), primaryType);
  const issuerSignature = await account.signTypedData({ domain, types, primaryType, message });

  return { ...acp, issuerSignature, _signedDomain: domain };
}

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

  describe('execute - acp chain resolution', () => {
    it('should use the signed acp chain when the builder chain is unset', async () => {
      const acp = await createSignedTestACP();
      const builder = createTxBuilder({ chainId: undefined });
      const productionDecrypt = vi.spyOn(builder as any, 'productionDecryptForTx').mockResolvedValue({
        ctHash: TEST_CT_HASH,
        decryptedValue: 1n,
        signature: '0x01',
      });

      await builder.withACP(acp).execute();

      expect(productionDecrypt).toHaveBeenCalledWith(acp, TEST_CHAIN_ID);
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

  describe('execute - acp chain resolution', () => {
    it('should prefer the signed acp chain over a stale builder chain', async () => {
      const acp = await createSignedTestACP();
      const builder = createViewBuilder(FheTypes.Uint32, { chainId: 1 });
      const productionDecrypt = vi.spyOn(builder as any, 'productionSealOutput').mockResolvedValue(1n);

      await builder.withACP(acp).execute();

      expect(productionDecrypt).toHaveBeenCalledWith(acp, TEST_CHAIN_ID);
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
