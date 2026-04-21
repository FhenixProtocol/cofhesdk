/**
 * Shared inherited test suite.
 *
 * Contains all SDK-level tests that should behave identically across
 * every chain (mock or production) and every environment (node or web).
 *
 * NOTE: Must not use process.env in this file.
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { Encryptable, FheTypes } from '@cofhe/sdk';
import { simpleTestAbi } from '@cofhe/integration-test-setup';
import type { TestChainConfig, ClientFactory, TestContext } from '../types.js';

export function runInheritedSuite(chainConfig: TestChainConfig, factory: ClientFactory) {
  let ctx: TestContext;

  beforeAll(async () => {
    ctx = await chainConfig.setup(factory);
  }, 60_000);

  afterAll(async () => {
    await chainConfig.teardown?.();
  });

  describe('Client Creation', () => {
    it('should create a client with expected surface', () => {
      expect(ctx.cofheClient).toBeDefined();
      expect(ctx.cofheClient.config).toBeDefined();
      expect(ctx.cofheClient.connected).toBe(true);
      expect(typeof ctx.cofheClient.connect).toBe('function');
      expect(typeof ctx.cofheClient.disconnect).toBe('function');
      expect(typeof ctx.cofheClient.encryptInputs).toBe('function');
      expect(typeof ctx.cofheClient.decryptForView).toBe('function');
      expect(typeof ctx.cofheClient.decryptForTx).toBe('function');
      expect(typeof ctx.cofheClient.getSnapshot).toBe('function');
      expect(typeof ctx.cofheClient.subscribe).toBe('function');
      expect(ctx.cofheClient.permits).toBeDefined();
    });
  });

  describe('Connection', () => {
    it('should be connected with correct chain and account', () => {
      const snapshot = ctx.cofheClient.getSnapshot();
      expect(snapshot.connected).toBe(true);
      expect(snapshot.chainId).toBe(chainConfig.id);
      expect(snapshot.account).toBe(ctx.bobAccount.address);
    });
  });

  describe('Encrypt Input', () => {
    it('should encrypt a uint128 value', async () => {
      const encrypted = await ctx.cofheClient.encryptInputs([Encryptable.uint128(100n)]).execute();

      expect(encrypted).toBeDefined();
      expect(encrypted.length).toBe(1);
      expect(encrypted[0].utype).toBe(FheTypes.Uint128);
      expect(encrypted[0].ctHash).toBeDefined();
      expect(typeof encrypted[0].ctHash).toBe('bigint');
      expect(encrypted[0].signature).toBeDefined();
      expect(typeof encrypted[0].signature).toBe('string');
      expect(encrypted[0].securityZone).toBe(0);
    }, 60_000);
  });

  describe('Self Permit', () => {
    it('should create a self permit', async () => {
      const permit = await ctx.cofheClient.permits.createSelf({
        issuer: ctx.bobAccount.address,
        name: 'Test Self Permit',
      });

      expect(permit).toBeDefined();
      expect(permit.type).toBe('self');
      expect(permit.name).toBe('Test Self Permit');
      expect(permit.issuer).toBe(ctx.bobAccount.address);
      expect(permit.issuerSignature).not.toBe('0x');
      expect(permit.sealingPair).toBeDefined();
      expect(permit.sealingPair.publicKey).toBeDefined();

      const activePermit = ctx.cofheClient.permits.getActivePermit();
      expect(activePermit).toBeDefined();
      expect(activePermit!.hash).toBe(permit.hash);
    }, 30_000);
  });

  describe('Sharing Permit', () => {
    it('should create a sharing permit, export it, and import it as another user', async () => {
      const sharingPermit = await ctx.cofheClient.permits.createSharing({
        issuer: ctx.bobAccount.address,
        recipient: ctx.aliceAccount.address,
        name: 'Test Sharing Permit',
      });

      expect(sharingPermit).toBeDefined();
      expect(sharingPermit.type).toBe('sharing');
      expect(sharingPermit.issuer).toBe(ctx.bobAccount.address);
      expect(sharingPermit.recipient).toBe(ctx.aliceAccount.address);
      expect(sharingPermit.issuerSignature).not.toBe('0x');

      const exported = ctx.cofheClient.permits.export(sharingPermit);
      expect(exported).toBeDefined();
      const parsed = JSON.parse(exported);
      expect(parsed.type).toBe('sharing');
      expect(parsed.issuer).toBe(ctx.bobAccount.address);
      expect(parsed.recipient).toBe(ctx.aliceAccount.address);
      expect(parsed.issuerSignature).toBeDefined();
      expect(parsed).not.toHaveProperty('sealingPair');

      // Alice imports the shared permit via a fresh client
      const aliceConfig = factory.createConfig({
        supportedChains: [chainConfig.cofheChain],
        ...(chainConfig.id === 31337
          ? {
              environment: 'hardhat' as const,
              mocks: { encryptDelay: 0 },
            }
          : {}),
      });
      const aliceClient = factory.createClient(aliceConfig);
      await aliceClient.connect(ctx.publicClient, ctx.aliceWalletClient);

      const importedPermit = await aliceClient.permits.importShared(exported);

      expect(importedPermit).toBeDefined();
      expect(importedPermit.type).toBe('recipient');
      expect(importedPermit.issuer).toBe(ctx.bobAccount.address);
      expect(importedPermit.recipient).toBe(ctx.aliceAccount.address);
      expect(importedPermit.recipientSignature).not.toBe('0x');
      expect(importedPermit.sealingPair).toBeDefined();
    }, 30_000);
  });

  describe('Decrypt for View (with permit)', () => {
    it('should encrypt → store → decryptForView a value', async () => {
      await ctx.cofheClient.permits.createSelf({
        issuer: ctx.bobAccount.address,
        name: 'Decrypt View Permit',
      });

      const testValue = 100n;
      const encrypted = await ctx.cofheClient.encryptInputs([Encryptable.uint32(testValue)]).execute();

      const encryptedInput = { ...encrypted[0], signature: encrypted[0].signature as `0x${string}` };
      const txHash = await ctx.bobWalletClient.writeContract({
        address: ctx.contractAddress,
        abi: simpleTestAbi,
        functionName: 'setValue',
        args: [encryptedInput],
        chain: chainConfig.viemChain,
        account: ctx.bobAccount,
      });
      await ctx.publicClient.waitForTransactionReceipt({ hash: txHash, retryCount: 30, pollingInterval: 4_000 });

      const ctHash = await ctx.publicClient.readContract({
        address: ctx.contractAddress,
        abi: simpleTestAbi,
        functionName: 'getValueHash',
      });

      const result = await ctx.cofheClient.decryptForView(ctHash, FheTypes.Uint32).execute();

      expect(result).toBe(testValue);
    }, 180_000);
  });

  describe('Decrypt for Tx (without permit)', () => {
    it('should encrypt → store public → decryptForTx → publishDecryptResult → verify', async () => {
      const testValue = 42n;
      const encrypted = await ctx.cofheClient.encryptInputs([Encryptable.uint32(testValue)]).execute();

      const encryptedInput = { ...encrypted[0], signature: encrypted[0].signature as `0x${string}` };
      const storeTxHash = await ctx.bobWalletClient.writeContract({
        address: ctx.contractAddress,
        abi: simpleTestAbi,
        functionName: 'setPublicValue',
        args: [encryptedInput],
        chain: chainConfig.viemChain,
        account: ctx.bobAccount,
      });
      await ctx.publicClient.waitForTransactionReceipt({ hash: storeTxHash, retryCount: 30, pollingInterval: 4_000 });

      const ctHash = await ctx.publicClient.readContract({
        address: ctx.contractAddress,
        abi: simpleTestAbi,
        functionName: 'publicValueHash',
      });

      const decryptResult = await ctx.cofheClient.decryptForTx(ctHash).withoutPermit().execute();

      expect(decryptResult.ctHash).toBe(ctHash);
      expect(decryptResult.decryptedValue).toBe(testValue);
      expect(decryptResult.signature).toBeDefined();

      const storedHandle = await ctx.publicClient.readContract({
        address: ctx.contractAddress,
        abi: simpleTestAbi,
        functionName: 'publicValue',
      });

      console.log('Stored handle:', storedHandle);
      console.log('Decrypt result:', decryptResult);
      console.log('Ct hash:', ctHash);

      const publishTxHash = await ctx.bobWalletClient.writeContract({
        address: ctx.contractAddress,
        abi: simpleTestAbi,
        functionName: 'publishDecryptResult',
        args: [storedHandle, Number(decryptResult.decryptedValue), decryptResult.signature],
        chain: chainConfig.viemChain,
        account: ctx.bobAccount,
      });
      const receipt = await ctx.publicClient.waitForTransactionReceipt({
        hash: publishTxHash,
        retryCount: 30,
        pollingInterval: 4_000,
      });
      console.log('Publish receipt:', receipt);

      const [publishedValue, isDecrypted] = await ctx.publicClient.readContract({
        address: ctx.contractAddress,
        abi: simpleTestAbi,
        functionName: 'getDecryptResultSafe',
        args: [storedHandle],
      });

      console.log('Published value:', publishedValue);
      console.log('Is decrypted:', isDecrypted);
      expect(isDecrypted).toBe(true);
      expect(BigInt(publishedValue)).toBe(testValue);
    }, 180_000);
  });
}
