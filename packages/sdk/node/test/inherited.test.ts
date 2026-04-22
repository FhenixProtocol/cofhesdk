import { Encryptable, FheTypes, type CofheClient } from '@/core';
import { arbSepolia as cofheArbSepolia } from '@/chains';
import { TEST_PRIVATE_KEY, simpleTestAbi, getSimpleTestAddress } from '@cofhe/test-setup';

import { describe, it, expect, beforeAll, beforeEach } from 'vitest';
import type { PublicClient, WalletClient } from 'viem';
import { createPublicClient, createWalletClient, http } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { arbitrumSepolia as viemArbitrumSepolia } from 'viem/chains';
import { createCofheClient, createCofheConfig } from '../index.js';

const DEFAULT_TEST_PRIVATE_KEY = '0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80';
const BOB_PRIVATE_KEY = (TEST_PRIVATE_KEY || DEFAULT_TEST_PRIVATE_KEY) as `0x${string}`;
const ALICE_PRIVATE_KEY = '0x59c6995e998f97a5a0044966f0945389dc9e86dae88c7a8412f4603b6b78690d';

const bobAccount = privateKeyToAccount(BOB_PRIVATE_KEY);
const aliceAccount = privateKeyToAccount(ALICE_PRIVATE_KEY);

const CHAIN_ID = cofheArbSepolia.id;

describe('@cofhe/node - Inherited Client Tests', () => {
  let cofheClient: CofheClient;
  let publicClient: PublicClient;
  let bobWalletClient: WalletClient;
  let aliceWalletClient: WalletClient;

  beforeAll(() => {
    publicClient = createPublicClient({
      chain: viemArbitrumSepolia,
      transport: http(),
    });

    bobWalletClient = createWalletClient({
      chain: viemArbitrumSepolia,
      transport: http(),
      account: bobAccount,
    });

    aliceWalletClient = createWalletClient({
      chain: viemArbitrumSepolia,
      transport: http(),
      account: aliceAccount,
    });
  });

  beforeEach(() => {
    const config = createCofheConfig({
      supportedChains: [cofheArbSepolia],
    });
    cofheClient = createCofheClient(config);
  });

  describe('Client Creation', () => {
    it('should create a client with expected surface', () => {
      expect(cofheClient).toBeDefined();
      expect(cofheClient.config).toBeDefined();
      expect(cofheClient.connected).toBe(false);
      expect(typeof cofheClient.connect).toBe('function');
      expect(typeof cofheClient.disconnect).toBe('function');
      expect(typeof cofheClient.encryptInputs).toBe('function');
      expect(typeof cofheClient.decryptForView).toBe('function');
      expect(typeof cofheClient.decryptForTx).toBe('function');
      expect(typeof cofheClient.getSnapshot).toBe('function');
      expect(typeof cofheClient.subscribe).toBe('function');
      expect(cofheClient.permits).toBeDefined();
    });
  });

  describe('Connection', () => {
    it('should connect to a real chain', async () => {
      await cofheClient.connect(publicClient, bobWalletClient);

      expect(cofheClient.connected).toBe(true);

      const snapshot = cofheClient.getSnapshot();
      expect(snapshot.connected).toBe(true);
      expect(snapshot.chainId).toBe(cofheArbSepolia.id);
      expect(snapshot.account).toBe(bobAccount.address);
    }, 30000);
  });

  describe('Encrypt Input', () => {
    it('should encrypt a uint128 value', async () => {
      await cofheClient.connect(publicClient, bobWalletClient);

      const encrypted = await cofheClient.encryptInputs([Encryptable.uint128(100n)]).execute();

      expect(encrypted).toBeDefined();
      expect(encrypted.length).toBe(1);
      expect(encrypted[0].utype).toBe(FheTypes.Uint128);
      expect(encrypted[0].ctHash).toBeDefined();
      expect(typeof encrypted[0].ctHash).toBe('bigint');
      expect(encrypted[0].signature).toBeDefined();
      expect(typeof encrypted[0].signature).toBe('string');
      expect(encrypted[0].securityZone).toBe(0);
    }, 60000);
  });

  describe('Self Permit', () => {
    it('should create a self permit', async () => {
      await cofheClient.connect(publicClient, bobWalletClient);

      const permit = await cofheClient.permits.createSelf({
        issuer: bobAccount.address,
        name: 'Test Self Permit',
      });

      expect(permit).toBeDefined();
      expect(permit.type).toBe('self');
      expect(permit.name).toBe('Test Self Permit');
      expect(permit.issuer).toBe(bobAccount.address);
      expect(permit.issuerSignature).not.toBe('0x');
      expect(permit.sealingPair).toBeDefined();
      expect(permit.sealingPair.publicKey).toBeDefined();

      const activePermit = cofheClient.permits.getActivePermit();
      expect(activePermit).toBeDefined();
      expect(activePermit!.hash).toBe(permit.hash);
    }, 30000);
  });

  describe('Sharing Permit', () => {
    it('should create a sharing permit, export it, and import it as another user', async () => {
      await cofheClient.connect(publicClient, bobWalletClient);

      const sharingPermit = await cofheClient.permits.createSharing({
        issuer: bobAccount.address,
        recipient: aliceAccount.address,
        name: 'Test Sharing Permit',
      });

      expect(sharingPermit).toBeDefined();
      expect(sharingPermit.type).toBe('sharing');
      expect(sharingPermit.issuer).toBe(bobAccount.address);
      expect(sharingPermit.recipient).toBe(aliceAccount.address);
      expect(sharingPermit.issuerSignature).not.toBe('0x');

      const exported = cofheClient.permits.export(sharingPermit);
      expect(exported).toBeDefined();
      const parsed = JSON.parse(exported);
      expect(parsed.type).toBe('sharing');
      expect(parsed.issuer).toBe(bobAccount.address);
      expect(parsed.recipient).toBe(aliceAccount.address);
      expect(parsed.issuerSignature).toBeDefined();
      expect(parsed).not.toHaveProperty('sealingPair');

      // Alice imports the shared permit
      const aliceConfig = createCofheConfig({
        supportedChains: [cofheArbSepolia],
      });
      const aliceClient = createCofheClient(aliceConfig);
      await aliceClient.connect(publicClient, aliceWalletClient);

      const importedPermit = await aliceClient.permits.importShared(exported);

      expect(importedPermit).toBeDefined();
      expect(importedPermit.type).toBe('recipient');
      expect(importedPermit.issuer).toBe(bobAccount.address);
      expect(importedPermit.recipient).toBe(aliceAccount.address);
      expect(importedPermit.recipientSignature).not.toBe('0x');
      expect(importedPermit.sealingPair).toBeDefined();
    }, 30000);
  });

  describe('Decrypt for View (with permit)', () => {
    it('should encrypt → store → decryptForView a value', async () => {
      const contractAddress = getSimpleTestAddress(CHAIN_ID);
      if (!contractAddress) throw new Error(`No SimpleTest deployment for chain ${CHAIN_ID}`);
      if (BOB_PRIVATE_KEY === DEFAULT_TEST_PRIVATE_KEY) return; // skip when unfunded

      await cofheClient.connect(publicClient, bobWalletClient);

      await cofheClient.permits.createSelf({
        issuer: bobAccount.address,
        name: 'Decrypt View Permit',
      });

      const testValue = 100n;
      const encrypted = await cofheClient.encryptInputs([Encryptable.uint32(testValue)]).execute();

      const encryptedInput = { ...encrypted[0], signature: encrypted[0].signature as `0x${string}` };
      const txHash = await bobWalletClient.writeContract({
        address: contractAddress,
        abi: simpleTestAbi,
        functionName: 'setValue',
        args: [encryptedInput],
        chain: viemArbitrumSepolia,
        account: bobAccount,
      });
      await publicClient.waitForTransactionReceipt({ hash: txHash });

      const ctHash = await publicClient.readContract({
        address: contractAddress,
        abi: simpleTestAbi,
        functionName: 'getValueHash',
      });

      const result = await cofheClient.decryptForView(ctHash, FheTypes.Uint32).execute();

      expect(result).toBe(testValue);
    }, 180000);
  });

  describe('Decrypt for Tx (without permit)', () => {
    it('should encrypt → store public → decryptForTx → publishDecryptResult → verify', async () => {
      const contractAddress = getSimpleTestAddress(CHAIN_ID);
      if (!contractAddress) throw new Error(`No SimpleTest deployment for chain ${CHAIN_ID}`);
      if (BOB_PRIVATE_KEY === DEFAULT_TEST_PRIVATE_KEY) return; // skip when unfunded

      await cofheClient.connect(publicClient, bobWalletClient);

      const testValue = 42n;
      const encrypted = await cofheClient.encryptInputs([Encryptable.uint32(testValue)]).execute();

      const encryptedInput = { ...encrypted[0], signature: encrypted[0].signature as `0x${string}` };
      const storeTxHash = await bobWalletClient.writeContract({
        address: contractAddress,
        abi: simpleTestAbi,
        functionName: 'setPublicValue',
        args: [encryptedInput],
        chain: viemArbitrumSepolia,
        account: bobAccount,
      });
      await publicClient.waitForTransactionReceipt({ hash: storeTxHash });

      const ctHash = await publicClient.readContract({
        address: contractAddress,
        abi: simpleTestAbi,
        functionName: 'publicValueHash',
      });

      const decryptResult = await cofheClient
        .decryptForTx(ctHash as `0x${string}`)
        .withoutPermit()
        .execute();

      expect(decryptResult.ctHash).toBe(ctHash);
      expect(decryptResult.decryptedValue).toBe(testValue);
      expect(decryptResult.signature).toBeDefined();

      const storedHandle = await publicClient.readContract({
        address: contractAddress,
        abi: simpleTestAbi,
        functionName: 'publicValue',
      });

      const publishTxHash = await bobWalletClient.writeContract({
        address: contractAddress,
        abi: simpleTestAbi,
        functionName: 'publishDecryptResult',
        args: [
          storedHandle as `0x${string}`,
          Number(decryptResult.decryptedValue),
          decryptResult.signature as `0x${string}`,
        ],
        chain: viemArbitrumSepolia,
        account: bobAccount,
      });
      await publicClient.waitForTransactionReceipt({ hash: publishTxHash });

      const [publishedValue, isDecrypted] = await publicClient.readContract({
        address: contractAddress,
        abi: simpleTestAbi,
        functionName: 'getDecryptResultSafe',
        args: [storedHandle as `0x${string}`],
      });
      expect(isDecrypted).toBe(true);
      expect(BigInt(publishedValue)).toBe(testValue);
    }, 180000);
  });
});
