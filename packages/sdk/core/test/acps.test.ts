/**
 * @vitest-environment happy-dom
 */
import { acpStore } from '@/acps';

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

// ACP domain resolution requires an upgraded on-chain ACL (domain ("ACL","2") served by the ACL itself).
// Public testnets still run the V2 contracts, so the domain fetch is stubbed here —
// these tests cover the acp orchestration flow, not on-chain domain resolution
// (exercised e2e against mocks in test/hardhat-plugin-test).
vi.mock('../../acps/onchain-utils.js', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../acps/onchain-utils.js')>()),
  getAclEIP712Domain: async () => ({
    name: 'ACL',
    version: '2',
    chainId: 421614,
    // arbitrary non-zero address — signatures are never verified on-chain in these tests
    verifyingContract: '0x1111111111111111111111111111111111111111' as `0x${string}`,
  }),
}));
import { createPublicClient, createWalletClient, http, type PublicClient, type WalletClient } from 'viem';
import { arbitrumSepolia } from 'viem/chains';
import { privateKeyToAccount } from 'viem/accounts';
import { acps } from '../acps.js';

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

describe('Core ACPs Tests', () => {
  beforeEach(() => {
    // Clear localStorage and reset stores
    localStorage.clear();
    acpStore.store.setState({ acps: {}, activeACPHash: {} });
  });

  afterEach(() => {
    localStorage.clear();
    acpStore.store.setState({ acps: {}, activeACPHash: {} });
  });

  describe('ACP Creation', () => {
    it('should create and store self acp', async () => {
      const acp = await acps.createSelf({ name: 'Test Self ACP', issuer: bobAddress }, publicClient, bobWalletClient);

      expect(acp).toBeDefined();
      expect(acp.name).toBe('Test Self ACP');
      expect(acp.type).toBe('self');
      expect(acp.issuer).toBe(bobAddress);
      expect(acp.issuerSignature).toBeDefined();
      expect(acp.issuerSignature).not.toBe('0x');

      // Verify localStorage
      const storedData = localStorage.getItem('cofhesdk-acps');
      expect(storedData).toBeDefined();
      const parsedData = JSON.parse(storedData!);
      expect(parsedData.state.acps[chainId][bobAddress]).toBeDefined();
      expect(parsedData.state.activeACPHash[chainId][bobAddress]).toBeDefined();
    });

    it('should create and store sharing acp', async () => {
      const acp = await acps.createSharing(
        {
          name: 'Test Sharing ACP',
          issuer: bobAddress,
          recipient: aliceAddress,
        },
        publicClient,
        bobWalletClient
      );

      expect(acp.name).toBe('Test Sharing ACP');
      expect(acp.type).toBe('sharing');
      expect(acp.issuer).toBe(bobAddress);
      expect(acp.recipient).toBe(aliceAddress);
      expect(acp.issuerSignature).toBeDefined();
      expect(acp.issuerSignature).not.toBe('0x');

      // Verify localStorage: the sharing acp is stored, but it must NOT become the issuer's
      // active acp (it's delegated to the recipient).
      const storedData = localStorage.getItem('cofhesdk-acps');
      expect(storedData).toBeDefined();
      const parsedData = JSON.parse(storedData!);
      expect(parsedData.state.acps[chainId][bobAddress]).toBeDefined();
      expect(parsedData.state.activeACPHash[chainId]?.[bobAddress]).toBeUndefined();
    });

    it('should import shared acp from JSON string', async () => {
      // First create a sharing acp to import
      const sharingACP = await acps.createSharing(
        {
          name: 'Original Sharing ACP',
          issuer: bobAddress,
          recipient: aliceAddress,
        },
        publicClient,
        bobWalletClient
      );

      // Export the acp as JSON string
      const acpJson = JSON.stringify({
        name: sharingACP.name,
        type: sharingACP.type,
        issuer: sharingACP.issuer,
        expiration: sharingACP.expiration,
        recipient: sharingACP.recipient,
        revokerData: sharingACP.revokerData,
        revokerContract: sharingACP.revokerContract,
        issuerSignature: sharingACP.issuerSignature,
      });

      // Import the acp as Alice (recipient)
      const acp = await acps.importShared(acpJson, publicClient, aliceWalletClient);

      expect(acp.name).toBe('Original Sharing ACP');
      expect(acp.type).toBe('recipient');
      expect(acp.issuer).toBe(bobAddress);
      expect(acp.recipient).toBe(aliceAddress);
      expect(acp.recipientSignature).toBeDefined();
      expect(acp.recipientSignature).not.toBe('0x');
    });
  });

  describe('ACP Retrieval', () => {
    let createdACP: any;
    let acpHash: string;

    beforeEach(async () => {
      // Create a real acp for testing
      createdACP = await acps.createSelf({ name: 'Test ACP', issuer: bobAddress }, publicClient, bobWalletClient);
      acpHash = createdACP.hash;
    });

    it('should get acp by hash', async () => {
      const acp = await acps.getACP(chainId, bobAddress, acpHash);
      expect(acp?.name).toBe('Test ACP');
      expect(acp?.type).toBe('self');
    });

    it('should get all acps', async () => {
      const allACPs = await acps.getACPs(chainId, bobAddress);
      expect(Object.keys(allACPs).length).toBeGreaterThan(0);
    });

    it('should get active acp', async () => {
      const acp = await acps.getActiveACP(chainId, bobAddress);
      expect(acp?.name).toBe('Test ACP');
    });

    it('should get active acp hash', async () => {
      const hash = await acps.getActiveACPHash(chainId, bobAddress);
      expect(typeof hash).toBe('string');
    });
  });

  describe('localStorage Integration', () => {
    it('should persist acps to localStorage', async () => {
      const createdACP = await acps.createSelf({ name: 'Test ACP', issuer: bobAddress }, publicClient, bobWalletClient);

      const storedData = localStorage.getItem('cofhesdk-acps');
      expect(storedData).toBeDefined();

      const parsedData = JSON.parse(storedData!);
      expect(parsedData.state.acps[chainId][bobAddress]).toBeDefined();
      expect(parsedData.state.activeACPHash[chainId][bobAddress]).toBeDefined();

      // Verify the acp data structure
      const acpKeys = Object.keys(parsedData.state.acps[chainId][bobAddress]);
      expect(acpKeys.length).toBeGreaterThan(0);

      const serializedACP = acps.serialize(createdACP);
      expect(parsedData.state.acps[chainId][bobAddress][createdACP.hash]).toEqual(serializedACP);
    });
  });

  describe('Real Network Integration', () => {
    it('should create acp with real EIP712 domain from Arbitrum Sepolia', async () => {
      const acp = await acps.createSelf(
        { name: 'Real Network ACP', issuer: bobAddress },
        publicClient,
        bobWalletClient
      );

      expect(acp._signedDomain).toBeDefined();
      expect(acp._signedDomain?.chainId).toBe(chainId);
      expect(acp._signedDomain?.name).toBeDefined();
      expect(acp._signedDomain?.version).toBeDefined();
      expect(acp._signedDomain?.verifyingContract).toBeDefined();
    });

    it('should handle multiple acps on real network', async () => {
      // Create multiple acps
      await acps.createSelf({ name: 'ACP 1', issuer: bobAddress }, publicClient, bobWalletClient);
      await acps.createSharing(
        {
          name: 'ACP 2',
          issuer: bobAddress,
          recipient: aliceAddress,
        },
        publicClient,
        bobWalletClient
      );

      // Verify both acps exist
      const allACPs = await acps.getACPs(chainId, bobAddress);
      expect(Object.keys(allACPs).length).toBeGreaterThanOrEqual(2);

      // The self acp stays active — creating the sharing (delegated) acp must not change it.
      const activeACP = await acps.getActiveACP(chainId, bobAddress);
      expect(activeACP?.name).toBe('ACP 1');
    });
  });

  describe('getOrCreateSelfACP', () => {
    it('should create a new self acp when none exists', async () => {
      const acp = await acps.getOrCreateSelfACP(publicClient, bobWalletClient, chainId, bobAddress, {
        issuer: bobAddress,
        name: 'New Self ACP',
      });

      expect(acp).toBeDefined();
      expect(acp.name).toBe('New Self ACP');
      expect(acp.type).toBe('self');
      expect(acp.issuer).toBe(bobAddress);
      expect(acp.issuerSignature).toBeDefined();

      // Verify it was stored and set as active
      const activeACP = await acps.getActiveACP(chainId, bobAddress);
      expect(activeACP?.name).toBe('New Self ACP');
    });

    it('should return existing self acp when one exists', async () => {
      // Create an initial self acp
      const firstACP = await acps.createSelf(
        { name: 'First Self ACP', issuer: bobAddress },
        publicClient,
        bobWalletClient
      );

      // Call getOrCreateSelfACP - should return existing
      const acp = await acps.getOrCreateSelfACP(publicClient, bobWalletClient, chainId, bobAddress, {
        issuer: bobAddress,
        name: 'Should Not Create This',
      });

      expect(acp.name).toBe('First Self ACP');
      expect(acp.hash).toBe(firstACP.hash);

      // Verify no new acp was created
      const allACPs = await acps.getACPs(chainId, bobAddress);
      expect(Object.keys(allACPs).length).toBe(1);
    });

    it('should create new self acp when active acp is sharing type', async () => {
      // Create a sharing acp first
      await acps.createSharing(
        {
          name: 'Sharing ACP',
          issuer: bobAddress,
          recipient: aliceAddress,
        },
        publicClient,
        bobWalletClient
      );

      // Call getOrCreateSelfACP - should create new since active is sharing type
      const acp = await acps.getOrCreateSelfACP(publicClient, bobWalletClient, chainId, bobAddress, {
        issuer: bobAddress,
        name: 'New Self ACP',
      });

      expect(acp.name).toBe('New Self ACP');
      expect(acp.type).toBe('self');

      // Verify two acps exist now
      const allACPs = await acps.getACPs(chainId, bobAddress);
      expect(Object.keys(allACPs).length).toBe(2);
    });

    it('should create a new self acp when active acp is expired', async () => {
      // Create an expired self acp (expiration in the past)
      const expiredACP = await acps.createSelf(
        { name: 'Expired Self ACP', issuer: bobAddress, expiration: Math.floor(Date.now() / 1000) - 3600 },
        publicClient,
        bobWalletClient
      );

      // Sanity check - it is the active acp and is expired
      const activeBefore = await acps.getActiveACP(chainId, bobAddress);
      expect(activeBefore?.hash).toBe(expiredACP.hash);

      // getOrCreateSelfACP should treat the expired acp as missing and create a fresh one
      const acp = await acps.getOrCreateSelfACP(publicClient, bobWalletClient, chainId, bobAddress, {
        issuer: bobAddress,
        name: 'Fresh Self ACP',
      });

      expect(acp.name).toBe('Fresh Self ACP');
      expect(acp.type).toBe('self');
      expect(acp.hash).not.toBe(expiredACP.hash);

      // The fresh acp should now be active
      const activeAfter = await acps.getActiveACP(chainId, bobAddress);
      expect(activeAfter?.hash).toBe(acp.hash);
    });

    it('should use default options when none provided', async () => {
      const acp = await acps.getOrCreateSelfACP(publicClient, bobWalletClient, chainId, bobAddress);

      expect(acp).toBeDefined();
      expect(acp.type).toBe('self');
      expect(acp.issuer).toBe(bobAddress);
      expect(acp.name).toBe('Autogenerated Self ACP');
    });

    it('should use default chainId and account when not provided', async () => {
      const acp = await acps.getOrCreateSelfACP(publicClient, bobWalletClient, undefined, undefined, {
        issuer: bobAddress,
        name: 'Test ACP',
      });

      expect(acp).toBeDefined();
      expect(acp.issuer).toBe(bobAddress);

      // Verify it was stored with the chain's actual chainId
      const activeACP = await acps.getActiveACP(chainId, bobAddress);
      expect(activeACP?.name).toBe('Test ACP');
    });
  });

  describe('getOrCreateSharingACP', () => {
    it('should create a new sharing acp when none exists', async () => {
      const acp = await acps.getOrCreateSharingACP(
        publicClient,
        bobWalletClient,
        {
          issuer: bobAddress,
          recipient: aliceAddress,
          name: 'New Sharing ACP',
        },
        chainId,
        bobAddress
      );

      expect(acp).toBeDefined();
      expect(acp.name).toBe('New Sharing ACP');
      expect(acp.type).toBe('sharing');
      expect(acp.issuer).toBe(bobAddress);
      expect(acp.recipient).toBe(aliceAddress);
      expect(acp.issuerSignature).toBeDefined();

      // Stored but NOT activated — a sharing acp is delegated, never the issuer's active acp.
      const allACPs = await acps.getACPs(chainId, bobAddress);
      expect(allACPs[acp.hash]?.name).toBe('New Sharing ACP');
      expect(await acps.getActiveACP(chainId, bobAddress)).toBeUndefined();
    });

    it('should return existing sharing acp when one exists', async () => {
      // Create an initial sharing acp, then make it active by hand (sharing acps are not
      // auto-activated), so getOrCreateSharingACP reuses it instead of creating another.
      const firstACP = await acps.createSharing(
        {
          name: 'First Sharing ACP',
          issuer: bobAddress,
          recipient: aliceAddress,
        },
        publicClient,
        bobWalletClient
      );
      acps.selectActiveACP(chainId, bobAddress, firstACP.hash);

      // Call getOrCreateSharingACP - should return existing
      const acp = await acps.getOrCreateSharingACP(
        publicClient,
        bobWalletClient,
        {
          issuer: bobAddress,
          recipient: aliceAddress,
          name: 'Should Not Create This',
        },
        chainId,
        bobAddress
      );

      expect(acp.name).toBe('First Sharing ACP');
      expect(acp.hash).toBe(firstACP.hash);

      // Verify no new acp was created
      const allACPs = await acps.getACPs(chainId, bobAddress);
      expect(Object.keys(allACPs).length).toBe(1);
    });

    it('should create new sharing acp when active acp is self type', async () => {
      // Create a self acp first
      await acps.createSelf({ name: 'Self ACP', issuer: bobAddress }, publicClient, bobWalletClient);

      // Call getOrCreateSharingACP - should create new since active is self type
      const acp = await acps.getOrCreateSharingACP(
        publicClient,
        bobWalletClient,
        {
          issuer: bobAddress,
          recipient: aliceAddress,
          name: 'New Sharing ACP',
        },
        chainId,
        bobAddress
      );

      expect(acp.name).toBe('New Sharing ACP');
      expect(acp.type).toBe('sharing');

      // Verify two acps exist now
      const allACPs = await acps.getACPs(chainId, bobAddress);
      expect(Object.keys(allACPs).length).toBe(2);
    });

    it('should create a new sharing acp when active acp is expired', async () => {
      // Create an expired sharing acp and make it the active acp (by hand — sharing acps
      // aren't auto-activated), so the "active acp is expired" branch is exercised.
      const expiredACP = await acps.createSharing(
        {
          name: 'Expired Sharing ACP',
          issuer: bobAddress,
          recipient: aliceAddress,
          expiration: Math.floor(Date.now() / 1000) - 3600,
        },
        publicClient,
        bobWalletClient
      );
      acps.selectActiveACP(chainId, bobAddress, expiredACP.hash);

      // getOrCreateSharingACP should treat the expired acp as missing and create a fresh one
      const acp = await acps.getOrCreateSharingACP(
        publicClient,
        bobWalletClient,
        {
          issuer: bobAddress,
          recipient: aliceAddress,
          name: 'Fresh Sharing ACP',
        },
        chainId,
        bobAddress
      );

      expect(acp.name).toBe('Fresh Sharing ACP');
      expect(acp.type).toBe('sharing');
      expect(acp.hash).not.toBe(expiredACP.hash);

      // The fresh sharing acp is stored (but not auto-activated).
      const allACPs = await acps.getACPs(chainId, bobAddress);
      expect(allACPs[acp.hash]).toBeDefined();
    });

    it('should use default chainId and account when not provided', async () => {
      const acp = await acps.getOrCreateSharingACP(
        publicClient,
        bobWalletClient,
        {
          issuer: bobAddress,
          recipient: aliceAddress,
          name: 'Test Sharing ACP',
        },
        undefined,
        undefined
      );

      expect(acp).toBeDefined();
      expect(acp.issuer).toBe(bobAddress);
      expect(acp.recipient).toBe(aliceAddress);

      // Stored under the connected wallet's chainId/account (not activated).
      const allACPs = await acps.getACPs(chainId, bobAddress);
      expect(allACPs[acp.hash]?.name).toBe('Test Sharing ACP');
    });
  });

  describe('Export', () => {
    it('throws when exporting a self acp', async () => {
      const acp = await acps.createSelf({ name: 'Test Self ACP', issuer: bobAddress }, publicClient, bobWalletClient);

      // export includes the issuer signature — only sharing acps are exportable
      expect(() => acps.export(acp)).toThrow(/only 'sharing' ACPs are exportable/);
    });

    it('should export sharing acp data with recipient and issuerSignature', async () => {
      const acp = await acps.createSharing(
        {
          name: 'Test Sharing ACP',
          issuer: bobAddress,
          recipient: aliceAddress,
        },
        publicClient,
        bobWalletClient
      );

      const exported = acps.export(acp);
      const parsed = JSON.parse(exported);

      expect(parsed.name).toBe('Test Sharing ACP');
      expect(parsed.type).toBe('sharing');
      expect(parsed.issuer).toBe(bobAddress);
      expect(parsed.recipient).toBe(aliceAddress);
      expect(parsed.issuerSignature).toBeDefined();
      expect(parsed.issuerSignature).not.toBe('0x');
      expect(parsed).not.toHaveProperty('sealingPair');
    });
  });

  describe('getOrCreate - Multiple Types Scenarios', () => {
    it('should keep the self acp active when a sharing acp is also created', async () => {
      // Create self acp (this one activates)
      const selfACP = await acps.getOrCreateSelfACP(publicClient, bobWalletClient, chainId, bobAddress, {
        issuer: bobAddress,
        name: 'Self ACP',
      });
      expect(selfACP.type).toBe('self');

      // Create sharing acp (creates a new one, but does NOT activate it)
      const sharingACP = await acps.getOrCreateSharingACP(
        publicClient,
        bobWalletClient,
        {
          issuer: bobAddress,
          recipient: aliceAddress,
          name: 'Sharing ACP',
        },
        chainId,
        bobAddress
      );
      expect(sharingACP.type).toBe('sharing');

      // Both should exist
      const allACPs = await acps.getACPs(chainId, bobAddress);
      expect(Object.keys(allACPs).length).toBe(2);

      // The active acp stays the self acp — creating the sharing acp doesn't hijack it.
      const activeACP = await acps.getActiveACP(chainId, bobAddress);
      expect(activeACP?.type).toBe('self');
      expect(activeACP?.name).toBe('Self ACP');
    });

    it('should correctly handle sequential getOrCreate calls', async () => {
      // First call - creates new
      const acp1 = await acps.getOrCreateSelfACP(publicClient, bobWalletClient, chainId, bobAddress, {
        issuer: bobAddress,
        name: 'ACP 1',
      });

      // Second call - returns existing
      const acp2 = await acps.getOrCreateSelfACP(publicClient, bobWalletClient, chainId, bobAddress, {
        issuer: bobAddress,
        name: 'ACP 2',
      });

      // Should be the same acp
      expect(acp1.hash).toBe(acp2.hash);
      expect(acp2.name).toBe('ACP 1'); // Original name

      // Only one acp should exist
      const allACPs = await acps.getACPs(chainId, bobAddress);
      expect(Object.keys(allACPs).length).toBe(1);
    });
  });
});
