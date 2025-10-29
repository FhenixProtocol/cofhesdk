/**
 * @vitest-environment happy-dom
 */
/* eslint-disable no-unused-vars */
import { permitStore } from '@/permits';

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { createPublicClient, createWalletClient, http, type PublicClient, type WalletClient } from 'viem';
import { arbitrumSepolia } from 'viem/chains';
import { privateKeyToAccount } from 'viem/accounts';
import { permits } from './permits.js';

// Type declarations for happy-dom environment
declare const localStorage: {
  clear: () => void;
  getItem: (name: string) => string | null;
  setItem: (name: string, value: string) => void;
};

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

describe('Core Permits Tests', () => {
  beforeEach(() => {
    // Clear localStorage and reset stores
    localStorage.clear();
    permitStore.store.setState({ permits: {}, activePermitHash: {} });
  });

  afterEach(() => {
    localStorage.clear();
    permitStore.store.setState({ permits: {}, activePermitHash: {} });
  });

  describe('Permit Creation', () => {
    it('should create and store self permit', async () => {
      const permit = await permits.createSelf(
        { name: 'Test Self Permit', issuer: bobAddress },
        publicClient,
        bobWalletClient
      );

      expect(permit).toBeDefined();
      expect(permit.name).toBe('Test Self Permit');
      expect(permit.type).toBe('self');
      expect(permit.issuer).toBe(bobAddress);
      expect(permit.issuerSignature).toBeDefined();
      expect(permit.issuerSignature).not.toBe('0x');

      // Verify localStorage
      const storedData = localStorage.getItem('cofhesdk-permits');
      expect(storedData).toBeDefined();
      const parsedData = JSON.parse(storedData!);
      expect(parsedData.state.permits[chainId][bobAddress]).toBeDefined();
      expect(parsedData.state.activePermitHash[chainId][bobAddress]).toBeDefined();
    });

    it('should create and store sharing permit', async () => {
      const permit = await permits.createSharing(
        {
          name: 'Test Sharing Permit',
          issuer: bobAddress,
          recipient: aliceAddress,
        },
        publicClient,
        bobWalletClient
      );

      expect(permit.name).toBe('Test Sharing Permit');
      expect(permit.type).toBe('sharing');
      expect(permit.issuer).toBe(bobAddress);
      expect(permit.recipient).toBe(aliceAddress);
      expect(permit.issuerSignature).toBeDefined();
      expect(permit.issuerSignature).not.toBe('0x');

      // Verify localStorage
      const storedData = localStorage.getItem('cofhesdk-permits');
      expect(storedData).toBeDefined();
      const parsedData = JSON.parse(storedData!);
      expect(parsedData.state.permits[chainId][bobAddress]).toBeDefined();
      expect(parsedData.state.activePermitHash[chainId][bobAddress]).toBeDefined();
    });

    it('should import shared permit from JSON string', async () => {
      // First create a sharing permit to import
      const sharingPermit = await permits.createSharing(
        {
          name: 'Original Sharing Permit',
          issuer: bobAddress,
          recipient: aliceAddress,
        },
        publicClient,
        bobWalletClient
      );

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

      // Import the permit as Alice (recipient)
      const permit = await permits.importShared(permitJson, publicClient, aliceWalletClient);

      expect(permit.name).toBe('Original Sharing Permit');
      expect(permit.type).toBe('recipient');
      expect(permit.issuer).toBe(bobAddress);
      expect(permit.recipient).toBe(aliceAddress);
      expect(permit.recipientSignature).toBeDefined();
      expect(permit.recipientSignature).not.toBe('0x');
    });
  });

  describe('Permit Retrieval', () => {
    let createdPermit: any;
    let permitHash: string;

    beforeEach(async () => {
      // Create a real permit for testing
      createdPermit = await permits.createSelf(
        { name: 'Test Permit', issuer: bobAddress },
        publicClient,
        bobWalletClient
      );
      permitHash = permits.getHash(createdPermit);
    });

    it('should get permit by hash', async () => {
      const permit = await permits.getPermit(chainId, bobAddress, permitHash);
      expect(permit?.name).toBe('Test Permit');
      expect(permit?.type).toBe('self');
    });

    it('should get all permits', async () => {
      const allPermits = await permits.getPermits(chainId, bobAddress);
      expect(Object.keys(allPermits).length).toBeGreaterThan(0);
    });

    it('should get active permit', async () => {
      const permit = await permits.getActivePermit(chainId, bobAddress);
      expect(permit?.name).toBe('Test Permit');
    });

    it('should get active permit hash', async () => {
      const hash = await permits.getActivePermitHash(chainId, bobAddress);
      expect(typeof hash).toBe('string');
    });
  });

  describe('localStorage Integration', () => {
    it('should persist permits to localStorage', async () => {
      const createdPermit = await permits.createSelf(
        { name: 'Test Permit', issuer: bobAddress },
        publicClient,
        bobWalletClient
      );

      const storedData = localStorage.getItem('cofhesdk-permits');
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
      const permit = await permits.createSelf(
        { name: 'Real Network Permit', issuer: bobAddress },
        publicClient,
        bobWalletClient
      );

      expect(permit._signedDomain).toBeDefined();
      expect(permit._signedDomain?.chainId).toBe(chainId);
      expect(permit._signedDomain?.name).toBeDefined();
      expect(permit._signedDomain?.version).toBeDefined();
      expect(permit._signedDomain?.verifyingContract).toBeDefined();
    });

    it('should handle multiple permits on real network', async () => {
      // Create multiple permits
      await permits.createSelf({ name: 'Permit 1', issuer: bobAddress }, publicClient, bobWalletClient);
      await permits.createSharing(
        {
          name: 'Permit 2',
          issuer: bobAddress,
          recipient: aliceAddress,
        },
        publicClient,
        bobWalletClient
      );

      // Verify both permits exist
      const allPermits = await permits.getPermits(chainId, bobAddress);
      expect(Object.keys(allPermits).length).toBeGreaterThanOrEqual(2);

      // Verify active permit is the last created one
      const activePermit = await permits.getActivePermit(chainId, bobAddress);
      expect(activePermit?.name).toBe('Permit 2');
    });
  });

  describe('getOrCreateSelfPermit', () => {
    it('should create a new self permit when none exists', async () => {
      const permit = await permits.getOrCreateSelfPermit(
        publicClient,
        bobWalletClient,
        chainId,
        bobAddress,
        { issuer: bobAddress, name: 'New Self Permit' }
      );

      expect(permit).toBeDefined();
      expect(permit.name).toBe('New Self Permit');
      expect(permit.type).toBe('self');
      expect(permit.issuer).toBe(bobAddress);
      expect(permit.issuerSignature).toBeDefined();

      // Verify it was stored and set as active
      const activePermit = await permits.getActivePermit(chainId, bobAddress);
      expect(activePermit?.name).toBe('New Self Permit');
    });

    it('should return existing self permit when one exists', async () => {
      // Create an initial self permit
      const firstPermit = await permits.createSelf(
        { name: 'First Self Permit', issuer: bobAddress },
        publicClient,
        bobWalletClient
      );

      // Call getOrCreateSelfPermit - should return existing
      const permit = await permits.getOrCreateSelfPermit(
        publicClient,
        bobWalletClient,
        chainId,
        bobAddress,
        { issuer: bobAddress, name: 'Should Not Create This' }
      );

      expect(permit.name).toBe('First Self Permit');
      expect(permits.getHash(permit)).toBe(permits.getHash(firstPermit));

      // Verify no new permit was created
      const allPermits = await permits.getPermits(chainId, bobAddress);
      expect(Object.keys(allPermits).length).toBe(1);
    });

    it('should create new self permit when active permit is sharing type', async () => {
      // Create a sharing permit first
      await permits.createSharing(
        {
          name: 'Sharing Permit',
          issuer: bobAddress,
          recipient: aliceAddress,
        },
        publicClient,
        bobWalletClient
      );

      // Call getOrCreateSelfPermit - should create new since active is sharing type
      const permit = await permits.getOrCreateSelfPermit(
        publicClient,
        bobWalletClient,
        chainId,
        bobAddress,
        { issuer: bobAddress, name: 'New Self Permit' }
      );

      expect(permit.name).toBe('New Self Permit');
      expect(permit.type).toBe('self');

      // Verify two permits exist now
      const allPermits = await permits.getPermits(chainId, bobAddress);
      expect(Object.keys(allPermits).length).toBe(2);
    });

    it('should use default options when none provided', async () => {
      const permit = await permits.getOrCreateSelfPermit(
        publicClient,
        bobWalletClient,
        chainId,
        bobAddress
      );

      expect(permit).toBeDefined();
      expect(permit.type).toBe('self');
      expect(permit.issuer).toBe(bobAddress);
      expect(permit.name).toBe('Autogenerated Self Permit');
    });

    it('should use default chainId and account when not provided', async () => {
      const permit = await permits.getOrCreateSelfPermit(
        publicClient,
        bobWalletClient,
        undefined,
        undefined,
        { issuer: bobAddress, name: 'Test Permit' }
      );

      expect(permit).toBeDefined();
      expect(permit.issuer).toBe(bobAddress);

      // Verify it was stored with the chain's actual chainId
      const activePermit = await permits.getActivePermit(chainId, bobAddress);
      expect(activePermit?.name).toBe('Test Permit');
    });
  });

  describe('getOrCreateSharingPermit', () => {
    it('should create a new sharing permit when none exists', async () => {
      const permit = await permits.getOrCreateSharingPermit(
        publicClient,
        bobWalletClient,
        chainId,
        bobAddress,
        {
          issuer: bobAddress,
          recipient: aliceAddress,
          name: 'New Sharing Permit',
        }
      );

      expect(permit).toBeDefined();
      expect(permit.name).toBe('New Sharing Permit');
      expect(permit.type).toBe('sharing');
      expect(permit.issuer).toBe(bobAddress);
      expect(permit.recipient).toBe(aliceAddress);
      expect(permit.issuerSignature).toBeDefined();

      // Verify it was stored and set as active
      const activePermit = await permits.getActivePermit(chainId, bobAddress);
      expect(activePermit?.name).toBe('New Sharing Permit');
    });

    it('should return existing sharing permit when one exists', async () => {
      // Create an initial sharing permit
      const firstPermit = await permits.createSharing(
        {
          name: 'First Sharing Permit',
          issuer: bobAddress,
          recipient: aliceAddress,
        },
        publicClient,
        bobWalletClient
      );

      // Call getOrCreateSharingPermit - should return existing
      const permit = await permits.getOrCreateSharingPermit(
        publicClient,
        bobWalletClient,
        chainId,
        bobAddress,
        {
          issuer: bobAddress,
          recipient: aliceAddress,
          name: 'Should Not Create This',
        }
      );

      expect(permit.name).toBe('First Sharing Permit');
      expect(permits.getHash(permit)).toBe(permits.getHash(firstPermit));

      // Verify no new permit was created
      const allPermits = await permits.getPermits(chainId, bobAddress);
      expect(Object.keys(allPermits).length).toBe(1);
    });

    it('should create new sharing permit when active permit is self type', async () => {
      // Create a self permit first
      await permits.createSelf(
        { name: 'Self Permit', issuer: bobAddress },
        publicClient,
        bobWalletClient
      );

      // Call getOrCreateSharingPermit - should create new since active is self type
      const permit = await permits.getOrCreateSharingPermit(
        publicClient,
        bobWalletClient,
        chainId,
        bobAddress,
        {
          issuer: bobAddress,
          recipient: aliceAddress,
          name: 'New Sharing Permit',
        }
      );

      expect(permit.name).toBe('New Sharing Permit');
      expect(permit.type).toBe('sharing');

      // Verify two permits exist now
      const allPermits = await permits.getPermits(chainId, bobAddress);
      expect(Object.keys(allPermits).length).toBe(2);
    });

    it('should throw error when options not provided and no active permit exists', async () => {
      await expect(
        permits.getOrCreateSharingPermit(publicClient, bobWalletClient, chainId, bobAddress)
      ).rejects.toThrow('CreateSharingPermitOptions with recipient is required when creating a new sharing permit');
    });

    it('should use default chainId and account when not provided', async () => {
      const permit = await permits.getOrCreateSharingPermit(
        publicClient,
        bobWalletClient,
        undefined,
        undefined,
        {
          issuer: bobAddress,
          recipient: aliceAddress,
          name: 'Test Sharing Permit',
        }
      );

      expect(permit).toBeDefined();
      expect(permit.issuer).toBe(bobAddress);
      expect(permit.recipient).toBe(aliceAddress);

      // Verify it was stored with the chain's actual chainId
      const activePermit = await permits.getActivePermit(chainId, bobAddress);
      expect(activePermit?.name).toBe('Test Sharing Permit');
    });
  });

  describe('getOrCreate - Multiple Types Scenarios', () => {
    it('should handle switching between self and sharing permits', async () => {
      // Create self permit
      const selfPermit = await permits.getOrCreateSelfPermit(
        publicClient,
        bobWalletClient,
        chainId,
        bobAddress,
        { issuer: bobAddress, name: 'Self Permit' }
      );
      expect(selfPermit.type).toBe('self');

      // Create sharing permit (should create new one)
      const sharingPermit = await permits.getOrCreateSharingPermit(
        publicClient,
        bobWalletClient,
        chainId,
        bobAddress,
        {
          issuer: bobAddress,
          recipient: aliceAddress,
          name: 'Sharing Permit',
        }
      );
      expect(sharingPermit.type).toBe('sharing');

      // Both should exist
      const allPermits = await permits.getPermits(chainId, bobAddress);
      expect(Object.keys(allPermits).length).toBe(2);

      // Active permit should be the sharing one
      const activePermit = await permits.getActivePermit(chainId, bobAddress);
      expect(activePermit?.type).toBe('sharing');
      expect(activePermit?.name).toBe('Sharing Permit');
    });

    it('should correctly handle sequential getOrCreate calls', async () => {
      // First call - creates new
      const permit1 = await permits.getOrCreateSelfPermit(
        publicClient,
        bobWalletClient,
        chainId,
        bobAddress,
        { issuer: bobAddress, name: 'Permit 1' }
      );

      // Second call - returns existing
      const permit2 = await permits.getOrCreateSelfPermit(
        publicClient,
        bobWalletClient,
        chainId,
        bobAddress,
        { issuer: bobAddress, name: 'Permit 2' }
      );

      // Should be the same permit
      expect(permits.getHash(permit1)).toBe(permits.getHash(permit2));
      expect(permit2.name).toBe('Permit 1'); // Original name

      // Only one permit should exist
      const allPermits = await permits.getPermits(chainId, bobAddress);
      expect(Object.keys(allPermits).length).toBe(1);
    });
  });
});
