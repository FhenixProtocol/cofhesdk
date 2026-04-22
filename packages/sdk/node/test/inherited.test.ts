import { Encryptable, FheTypes, type CofheClient } from '@/core';
import { arbSepolia as cofheArbSepolia, getChainById } from '@/chains';
import {
  TEST_PRIVATE_KEY,
  PRIMARY_TEST_CHAIN,
  primaryTestChainRegistry,
  isPrimaryTestChainReady,
} from '@cofhe/test-setup';

import { describe, it, expect, beforeAll, beforeEach } from 'vitest';
import type { Chain, PublicClient, WalletClient } from 'viem';
import { createPublicClient, createWalletClient, http } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { arbitrumSepolia, baseSepolia, sepolia } from 'viem/chains';
import { createCofheClient, createCofheConfig } from '../index.js';

const DEFAULT_TEST_PRIVATE_KEY = '0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80';
const BOB_PRIVATE_KEY = (TEST_PRIVATE_KEY || DEFAULT_TEST_PRIVATE_KEY) as `0x${string}`;
const ALICE_PRIVATE_KEY = '0x59c6995e998f97a5a0044966f0945389dc9e86dae88c7a8412f4603b6b78690d';

const bobAccount = privateKeyToAccount(BOB_PRIVATE_KEY);
const aliceAccount = privateKeyToAccount(ALICE_PRIVATE_KEY);

const VIEM_CHAINS: Record<number, Chain> = {
  421614: arbitrumSepolia,
  84532: baseSepolia,
  11155111: sepolia,
};

describe('@cofhe/node - Inherited Client Tests', () => {
  let cofheClient: CofheClient;
  let publicClient: PublicClient;
  let bobWalletClient: WalletClient;
  let aliceWalletClient: WalletClient;

  beforeAll(() => {
    publicClient = createPublicClient({
      chain: arbitrumSepolia,
      transport: http(),
    });

    bobWalletClient = createWalletClient({
      chain: arbitrumSepolia,
      transport: http(),
      account: bobAccount,
    });

    aliceWalletClient = createWalletClient({
      chain: arbitrumSepolia,
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

  describe('Decrypt (read-only, pre-stored values)', () => {
    let decryptClient: CofheClient;
    let decryptPublicClient: PublicClient;
    let decryptWalletClient: WalletClient;

    let privateCtHash: `0x${string}`;
    let privateValue: bigint;
    let publicCtHash: `0x${string}`;
    let publicValue: bigint;

    beforeAll(() => {
      if (!isPrimaryTestChainReady(primaryTestChainRegistry)) {
        throw new Error('Primary test chain registry not initialized. Run `pnpm test:setup` first.');
      }

      const reg = primaryTestChainRegistry;
      const viemChain = VIEM_CHAINS[reg.chainId];
      if (!viemChain) throw new Error(`No viem chain mapping for chain ${reg.chainId}`);

      const cofheChain = getChainById(reg.chainId);
      if (!cofheChain) throw new Error(`No cofhe chain config for chain ${reg.chainId}`);

      privateCtHash = reg.privateValue.ctHash as `0x${string}`;
      privateValue = BigInt(reg.privateValue.value);
      publicCtHash = reg.publicValue.ctHash as `0x${string}`;
      publicValue = BigInt(reg.publicValue.value);

      decryptPublicClient = createPublicClient({ chain: viemChain, transport: http() });
      decryptWalletClient = createWalletClient({ chain: viemChain, transport: http(), account: bobAccount });

      const config = createCofheConfig({ supportedChains: [cofheChain] });
      decryptClient = createCofheClient(config);
    });

    it('decryptForView — private value with permit', async () => {
      await decryptClient.connect(decryptPublicClient, decryptWalletClient);

      await decryptClient.permits.createSelf({
        issuer: bobAccount.address,
        name: 'Decrypt View Permit',
      });

      const result = await decryptClient.decryptForView(privateCtHash, FheTypes.Uint32).execute();
      expect(result).toBe(privateValue);
    }, 180000);

    it('decryptForTx — public value without permit', async () => {
      await decryptClient.connect(decryptPublicClient, decryptWalletClient);

      const result = await decryptClient.decryptForTx(publicCtHash).withoutPermit().execute();

      expect(BigInt(result.ctHash)).toBe(BigInt(publicCtHash));
      expect(result.decryptedValue).toBe(publicValue);
      expect(result.signature).toMatch(/^0x[0-9a-fA-F]+$/);
    }, 180000);

    it('decryptForTx — private value with permit', async () => {
      await decryptClient.connect(decryptPublicClient, decryptWalletClient);

      const permit = await decryptClient.permits.createSelf({
        issuer: bobAccount.address,
        name: 'Decrypt Tx Permit',
      });

      const result = await decryptClient.decryptForTx(privateCtHash).withPermit(permit).execute();

      expect(BigInt(result.ctHash)).toBe(BigInt(privateCtHash));
      expect(result.decryptedValue).toBe(privateValue);
      expect(result.signature).toBeDefined();
    }, 180000);
  });
});
