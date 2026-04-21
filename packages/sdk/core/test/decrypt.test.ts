import { FheTypes, verifyDecryptResult, createCofheConfigBase, TASK_MANAGER_ADDRESS } from '@/core';
import { getChainById } from '@/chains';
import { permits } from '../permits.js';
import { DecryptForTxBuilder } from '../decrypt/decryptForTxBuilder.js';
import { DecryptForViewBuilder } from '../decrypt/decryptForViewBuilder.js';

import { describe, it, expect, beforeAll } from 'vitest';
import type { Chain, PublicClient, WalletClient } from 'viem';
import { createPublicClient, createWalletClient, http, parseAbi } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { arbitrumSepolia, baseSepolia, sepolia } from 'viem/chains';
import {
  TEST_PRIVATE_KEY,
  PRIMARY_TEST_CHAIN,
  primaryTestChainRegistry,
  isPrimaryTestChainReady,
} from '@cofhe/integration-test-setup';

const account = privateKeyToAccount(TEST_PRIVATE_KEY);

const VIEM_CHAINS: Record<number, Chain> = {
  421614: arbitrumSepolia,
  84532: baseSepolia,
  11155111: sepolia,
};

describe('Core – Decrypt Tests', () => {
  let publicClient: PublicClient;
  let walletClient: WalletClient;
  let config: ReturnType<typeof createCofheConfigBase>;

  let privateCtHash: `0x${string}`;
  let privateValue: bigint;

  let publicCtHash: `0x${string}`;
  let publicValue: bigint;

  beforeAll(() => {
    if (!isPrimaryTestChainReady(primaryTestChainRegistry)) {
      throw new Error('Primary test chain registry is not initialized. Run `pnpm test:setup` first.');
    }

    const reg = primaryTestChainRegistry;
    const chainId = reg.chainId;

    const viemChain = VIEM_CHAINS[chainId];
    if (!viemChain) throw new Error(`No viem chain mapping for chain ${chainId}`);

    const cofheChain = getChainById(chainId);
    if (!cofheChain) throw new Error(`No cofhe chain config for chain ${chainId}`);

    config = createCofheConfigBase({ supportedChains: [cofheChain] });

    privateCtHash = reg.privateValue.ctHash as `0x${string}`;
    privateValue = BigInt(reg.privateValue.value);

    publicCtHash = reg.publicValue.ctHash as `0x${string}`;
    publicValue = BigInt(reg.publicValue.value);

    publicClient = createPublicClient({ chain: viemChain, transport: http() });
    walletClient = createWalletClient({ chain: viemChain, transport: http(), account });
  });

  function txBuilder(ctHash: `0x${string}`) {
    return new DecryptForTxBuilder({
      config,
      publicClient,
      walletClient,
      chainId: PRIMARY_TEST_CHAIN,
      account: account.address,
      ctHash,
      requireConnected: undefined,
    });
  }

  function viewBuilder(ctHash: `0x${string}`, utype: FheTypes) {
    return new DecryptForViewBuilder({
      config,
      publicClient,
      walletClient,
      chainId: PRIMARY_TEST_CHAIN,
      account: account.address,
      ctHash,
      utype,
      requireConnected: undefined,
    });
  }

  async function createPermit() {
    return permits.createSelf({ issuer: account.address, name: 'Decrypt Test Permit' }, publicClient, walletClient);
  }

  // ---------------------------------------------------------------------------
  // decryptForTx – withoutPermit (global allowance)
  // ---------------------------------------------------------------------------

  describe('decryptForTx – withoutPermit (global allowance)', () => {
    it('should decrypt a publicly allowed ciphertext', async () => {
      const result = await txBuilder(publicCtHash).withoutPermit().execute();

      expect(BigInt(result.ctHash)).toBe(BigInt(publicCtHash));
      expect(result.decryptedValue).toBe(publicValue);
      expect(result.signature).toMatch(/^0x[0-9a-fA-F]+$/);
    }, 180000);
  });

  // ---------------------------------------------------------------------------
  // decryptForTx – withPermit
  // ---------------------------------------------------------------------------

  describe('decryptForTx – withPermit', () => {
    it('should decrypt with a self permit', async () => {
      const permit = await createPermit();

      const result = await txBuilder(privateCtHash).withPermit(permit).execute();

      expect(BigInt(result.ctHash)).toBe(BigInt(privateCtHash));
      expect(result.decryptedValue).toBe(privateValue);
      expect(result.signature).toBeDefined();
    }, 180000);

    it('should auto-resolve active permit', async () => {
      const permit = await createPermit();
      permits.selectActivePermit(PRIMARY_TEST_CHAIN, account.address, permit.hash);

      const result = await txBuilder(privateCtHash).withPermit().execute();

      expect(BigInt(result.ctHash)).toBe(BigInt(privateCtHash));
      expect(result.decryptedValue).toBe(privateValue);
    }, 180000);
  });

  // ---------------------------------------------------------------------------
  // verifyDecryptResult
  // ---------------------------------------------------------------------------

  describe('verifyDecryptResult', () => {
    it('should verify a valid decrypt result', async () => {
      const permit = await createPermit();

      const decryptResult = await txBuilder(privateCtHash).withPermit(permit).execute();

      const isValid = await verifyDecryptResult(
        decryptResult.ctHash,
        privateValue,
        decryptResult.signature,
        publicClient
      );
      expect(isValid).toBe(true);
    }, 180000);

    it('should return false for invalid inputs', async () => {
      const permit = await createPermit();

      const decryptResult = await txBuilder(privateCtHash).withPermit(permit).execute();

      expect(
        await verifyDecryptResult(decryptResult.ctHash, privateValue + 1n, decryptResult.signature, publicClient)
      ).toBe(false);
    }, 180000);
  });

  // ---------------------------------------------------------------------------
  // decryptForView
  // ---------------------------------------------------------------------------

  describe('decryptForView', () => {
    it('should return the plaintext value', async () => {
      await createPermit();

      const result = await viewBuilder(privateCtHash, FheTypes.Uint32).execute();
      expect(result).toBe(privateValue);
    }, 180000);

    it('should agree with decryptForTx on the same handle', async () => {
      const permit = await createPermit();

      const viewResult = await viewBuilder(privateCtHash, FheTypes.Uint32).execute();
      const txResult = await txBuilder(privateCtHash).withPermit(permit).execute();

      expect(viewResult).toBe(privateValue);
      expect(BigInt(txResult.ctHash)).toBe(BigInt(privateCtHash));
      expect(txResult.decryptedValue).toBe(privateValue);
    }, 180000);
  });

  describe('verifyDecryptResult', () => {
    it('should correctly verify a valid decrypt result', async () => {
      const permit = await createPermit();

      const decryptResult = await txBuilder(privateCtHash).withPermit(permit).execute();

      const isValid = await verifyDecryptResult(
        decryptResult.ctHash,
        privateValue,
        decryptResult.signature,
        publicClient
      );
      expect(isValid).toBe(true);
    }, 180000);

    it('should verify identically to the on-chain TaskManager contract', async () => {
      const permit = await createPermit();
      const decryptResult = await txBuilder(privateCtHash).withPermit(permit).execute();

      const samples = [
        {
          shouldBe: true,
          handle: BigInt(decryptResult.ctHash),
          cleartext: decryptResult.decryptedValue,
          signature: decryptResult.signature,
        },
        {
          shouldBe: false,
          handle: BigInt(decryptResult.ctHash),
          cleartext: decryptResult.decryptedValue + 1n,
          signature: decryptResult.signature,
        },
        {
          shouldBe: false,
          handle: BigInt(decryptResult.ctHash) + 1n,
          cleartext: decryptResult.decryptedValue,
          signature: decryptResult.signature,
        },
        {
          shouldBe: false,
          handle: BigInt(decryptResult.ctHash),
          cleartext: decryptResult.decryptedValue,
          signature: `${decryptResult.signature}00`,
        },
      ] as const;

      for (const sample of samples) {
        const sdkResult = await verifyDecryptResult(sample.handle, sample.cleartext, sample.signature, publicClient);

        const verifyDecryptResultSafeAbi = parseAbi([
          'function verifyDecryptResultSafe(uint256 ctHash, uint256 cleartext, bytes signature) view returns (bool)',
        ]);
        const tmResult = await publicClient.readContract({
          address: TASK_MANAGER_ADDRESS,
          abi: verifyDecryptResultSafeAbi,
          functionName: 'verifyDecryptResultSafe',
          args: [sample.handle, sample.cleartext, sample.signature],
        });

        expect(sdkResult).to.equal(tmResult);
        expect(sdkResult).to.equal(sample.shouldBe);
      }
    });
  });
});
