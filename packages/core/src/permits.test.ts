/**
 * @vitest-environment happy-dom
 */

// Type declarations for happy-dom environment
declare const localStorage: Storage;

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { createPublicClient, createWalletClient, http, PublicClient, WalletClient } from 'viem';
import { arbitrumSepolia } from 'viem/chains';
import { permits } from './permits';
import { sdkStore } from './sdkStore';
import { permitStore, PermitUtils } from '@cofhesdk/permits';
import { privateKeyToAccount } from 'viem/accounts';

// Test private keys (well-known test keys from Anvil/Hardhat)
const BOB_PRIVATE_KEY = '0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80'; // Bob - always issuer
const ALICE_PRIVATE_KEY = '0x59c6995e998f97a5a0044966f0945389dc9e86dae88c7a8412f4603b6b78690d'; // Alice - always recipient

// Create real viem clients for Arbitrum Sepolia
const publicClient: PublicClient = createPublicClient({
  chain: arbitrumSepolia,
  transport: http(),
});

const bobWalletClient: WalletClient = createWalletClient({
  chain: arbitrumSepolia,
  transport: http(),
  account: privateKeyToAccount(BOB_PRIVATE_KEY),
});

const aliceWalletClient: WalletClient = createWalletClient({
  chain: arbitrumSepolia,
  transport: http(),
  account: privateKeyToAccount(ALICE_PRIVATE_KEY),
});

// Helper to get the wallet addresses
const bobAddress = bobWalletClient.account!.address;
const aliceAddress = aliceWalletClient.account!.address;
const chainId = 421614; // Arbitrum Sepolia

describe('Core Permits Tests with Real Clients', () => {
  beforeEach(async () => {
    // Clear localStorage and reset stores
    localStorage.clear();
    sdkStore.clearSdkStore();
    permitStore.store.setState({ permits: {}, activePermitHash: {} });

    sdkStore.setPublicClient(publicClient);
    sdkStore.setWalletClient(bobWalletClient);
  });

  afterEach(() => {
    localStorage.clear();
    sdkStore.clearSdkStore();
    permitStore.store.setState({ permits: {}, activePermitHash: {} });
  });

  describe('Permit Creation', () => {
    it('should create and store self permit', async () => {
      const result = await permits.createSelf({ name: 'Test Self Permit', issuer: bobAddress });

      expect(result).toBeDefined();
      expect(result.name).toBe('Test Self Permit');
      expect(result.type).toBe('self');
      expect(result.issuer).toBe(bobAddress);
      expect(result.issuerSignature).toBeDefined();
      expect(result.issuerSignature).not.toBe('0x');

      // Verify localStorage
      const storedData = localStorage.getItem('cofhejs-permits');
      expect(storedData).toBeDefined();
      const parsedData = JSON.parse(storedData!);
      expect(parsedData.state.permits[chainId][bobAddress]).toBeDefined();
      expect(parsedData.state.activePermitHash[chainId][bobAddress]).toBeDefined();
    });

    it('should create and store sharing permit', async () => {
      const result = await permits.createSharing({
        name: 'Test Sharing Permit',
        issuer: bobAddress,
        recipient: aliceAddress,
      });

      expect(result).toBeDefined();
      expect(result.name).toBe('Test Sharing Permit');
      expect(result.type).toBe('sharing');
      expect(result.issuer).toBe(bobAddress);
      expect(result.recipient).toBe(aliceAddress);
      expect(result.issuerSignature).toBeDefined();
      expect(result.issuerSignature).not.toBe('0x');

      // Verify localStorage
      const storedData = localStorage.getItem('cofhejs-permits');
      expect(storedData).toBeDefined();
      const parsedData = JSON.parse(storedData!);
      expect(parsedData.state.permits[chainId][bobAddress]).toBeDefined();
      expect(parsedData.state.activePermitHash[chainId][bobAddress]).toBeDefined();
    });

    it('should import shared permit from JSON string', async () => {
      // First create a sharing permit to import
      const sharingPermit = await permits.createSharing({
        name: 'Original Sharing Permit',
        issuer: bobAddress,
        recipient: aliceAddress,
      });

      // Export the permit as JSON string
      const permitJson = JSON.stringify({
        name: sharingPermit.name,
        type: sharingPermit.type,
        issuer: sharingPermit.issuer,
        expiration: sharingPermit.expiration,
        recipient: sharingPermit.recipient,
        validatorId: sharingPermit.validatorId,
        validatorContract: sharingPermit.validatorContract,
        issuerSignature: sharingPermit.issuerSignature,
      });

      // Import the permit as a different user
      const result = await permits.importShared(permitJson);

      expect(result).toBeDefined();
      expect(result.name).toBe('Original Sharing Permit');
      expect(result.type).toBe('recipient');
      expect(result.issuer).toBe(bobAddress);
      expect(result.recipient).toBe(aliceAddress);
      expect(result.recipientSignature).toBeDefined();
      expect(result.recipientSignature).not.toBe('0x');
    });
  });

  describe('Permit Retrieval', () => {
    let createdPermit: any;
    let permitHash: string;

    beforeEach(async () => {
      // Create a real permit for testing
      createdPermit = await permits.createSelf({ name: 'Test Permit', issuer: bobAddress });
      permitHash = permits.getHash(createdPermit);
    });

    it('should get permit by hash', async () => {
      const result = await permits.getPermit(permitHash);
      expect(result).toBeDefined();
      expect(result?.name).toBe('Test Permit');
      expect(result?.type).toBe('self');
    });

    it('should get all permits', async () => {
      const result = await permits.getPermits({});
      expect(result).toBeDefined();
      expect(Object.keys(result).length).toBeGreaterThan(0);
    });

    it('should get active permit', async () => {
      const result = await permits.getActivePermit({});
      expect(result).toBeDefined();
      expect(result?.name).toBe('Test Permit');
    });

    it('should get active permit hash', async () => {
      const result = await permits.getActivePermitHash({});
      expect(result).toBeDefined();
      expect(typeof result).toBe('string');
    });
  });

  describe('localStorage Integration', () => {
    it('should persist permits to localStorage', async () => {
      const createdPermit = await permits.createSelf({ name: 'Test Permit', issuer: bobAddress });

      const storedData = localStorage.getItem('cofhejs-permits');
      expect(storedData).toBeDefined();

      const parsedData = JSON.parse(storedData!);
      expect(parsedData.state.permits[chainId][bobAddress]).toBeDefined();
      expect(parsedData.state.activePermitHash[chainId][bobAddress]).toBeDefined();

      // Verify the permit data structure
      const permitKeys = Object.keys(parsedData.state.permits[chainId][bobAddress]);
      expect(permitKeys.length).toBeGreaterThan(0);

      const permitHash = permits.getHash(createdPermit);
      const serializedPermit = permits.serialize(createdPermit);
      expect(parsedData.state.permits[chainId][bobAddress][permitHash]).toEqual(serializedPermit);
    });
  });

  describe('Real Network Integration', () => {
    it('should create permit with real EIP712 domain from Arbitrum Sepolia', async () => {
      const permit = await permits.createSelf({ name: 'Real Network Permit', issuer: bobAddress });

      expect(permit).toBeDefined();
      expect(permit._signedDomain).toBeDefined();
      expect(permit._signedDomain?.chainId).toBe(chainId);
      expect(permit._signedDomain?.name).toBeDefined();
      expect(permit._signedDomain?.version).toBeDefined();
      expect(permit._signedDomain?.verifyingContract).toBeDefined();
    });

    it('should handle multiple permits on real network', async () => {
      // Create multiple permits
      await permits.createSelf({ name: 'Permit 1', issuer: bobAddress });
      await permits.createSharing({
        name: 'Permit 2',
        issuer: bobAddress,
        recipient: aliceAddress,
      });

      // Verify both permits exist
      const allPermits = await permits.getPermits({});
      expect(Object.keys(allPermits).length).toBeGreaterThanOrEqual(2);

      // Verify active permit is the last created one
      const activePermit = await permits.getActivePermit({});
      expect(activePermit?.name).toBe('Permit 2');
    });
  });
});
