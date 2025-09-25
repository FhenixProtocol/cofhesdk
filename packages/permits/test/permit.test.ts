import { describe, it, expect } from 'vitest';
import {
  PermitUtils,
  CreateSelfPermitOptions,
  CreateSharingPermitOptions,
  ImportSharedPermitOptions,
} from '../src/index';
import { createPublicClient, createWalletClient, http, type PublicClient, type WalletClient } from 'viem';
import { arbitrumSepolia } from 'viem/chains';
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

describe('PermitUtils Tests', () => {
  describe('createSelf', () => {
    it('should create a self permit with valid options', async () => {
      const options: CreateSelfPermitOptions = {
        type: 'self',
        issuer: bobAddress,
        name: 'Test Permit',
      };

      const permit = await PermitUtils.createSelf(options);

      expect(permit.type).toBe('self');
      expect(permit.name).toBe('Test Permit');
      expect(permit.type).toBe('self');
      expect(permit.issuer).toBe(bobAddress);
      expect(permit.sealingPair).toBeDefined();
      expect(permit.sealingPair.privateKey).toBeDefined();
      expect(permit.sealingPair.publicKey).toBeDefined();

      // Should not be signed yet
      expect(permit.issuerSignature).toBe('0x');
      expect(permit.recipientSignature).toBe('0x');
    });

    it('should throw error for invalid options', async () => {
      const options: CreateSelfPermitOptions = {
        type: 'self',
        issuer: 'invalid-address',
        name: 'Test Permit',
      };

      await expect(PermitUtils.createSelf(options)).rejects.toThrow();
    });
  });

  describe('createSharing', () => {
    it('should create a sharing permit with valid options', async () => {
      const options: CreateSharingPermitOptions = {
        type: 'sharing',
        issuer: bobAddress,
        recipient: aliceAddress,
        name: 'Test Sharing Permit',
      };

      const permit = await PermitUtils.createSharing(options);

      expect(permit.type).toBe('sharing');
      expect(permit.name).toBe('Test Sharing Permit');
      expect(permit.type).toBe('sharing');
      expect(permit.issuer).toBe(bobAddress);
      expect(permit.recipient).toBe(aliceAddress);
      expect(permit.sealingPair).toBeDefined();
      expect(permit.sealingPair.privateKey).toBeDefined();
      expect(permit.sealingPair.publicKey).toBeDefined();

      // Should not be signed yet
      expect(permit.issuerSignature).toBe('0x');
      expect(permit.recipientSignature).toBe('0x');
    });

    it('should throw error for invalid recipient', async () => {
      const options: CreateSharingPermitOptions = {
        type: 'sharing',
        issuer: bobAddress,
        recipient: 'invalid-address',
        name: 'Test Sharing Permit',
      };

      await expect(PermitUtils.createSharing(options)).rejects.toThrow();
    });
  });

  describe('importShared', () => {
    it('should import a shared permit with valid options', async () => {
      const options: ImportSharedPermitOptions = {
        issuer: bobAddress,
        recipient: aliceAddress,
        issuerSignature: '0x1234567890abcdef',
        name: 'Test Import Permit',
      };

      const permit = await PermitUtils.importShared(options);

      expect(permit.type).toBe('recipient');
      expect(permit.name).toBe('Test Import Permit');
      expect(permit.issuer).toBe(bobAddress);
      expect(permit.recipient).toBe(aliceAddress);
      expect(permit.issuerSignature).toBe('0x1234567890abcdef');
      expect(permit.sealingPair).toBeDefined();
      expect(permit.sealingPair.privateKey).toBeDefined();
      expect(permit.sealingPair.publicKey).toBeDefined();

      // Should not be signed yet
      expect(permit.recipientSignature).toBe('0x');
    });

    it('should import a shared permit with valid options as string', async () => {
      const options: ImportSharedPermitOptions = {
        issuer: bobAddress,
        recipient: aliceAddress,
        issuerSignature: '0x1234567890abcdef',
      };

      const stringOptions = JSON.stringify(options);

      const permit = await PermitUtils.importShared(stringOptions);

      expect(permit.type).toBe('recipient');
    });

    it('should throw error for invalid permit type', async () => {
      const options = {
        type: 'self',
        issuer: bobAddress,
        recipient: aliceAddress,
        issuerSignature: '0x1234567890abcdef',
      } as unknown as ImportSharedPermitOptions;

      await expect(PermitUtils.importShared(options)).rejects.toThrow();

      const options2 = {
        type: 'recipient',
        issuer: bobAddress,
        recipient: aliceAddress,
        issuerSignature: '0x1234567890abcdef',
      } as unknown as ImportSharedPermitOptions;

      await expect(PermitUtils.importShared(options2)).rejects.toThrow();
    });

    it('should throw error for missing issuerSignature', async () => {
      const options: ImportSharedPermitOptions = {
        issuer: bobAddress,
        recipient: aliceAddress,
        issuerSignature: '0x', // Invalid empty signature
        name: 'Test Import Permit',
      };

      await expect(PermitUtils.importShared(options)).rejects.toThrow();
    });
  });

  describe('createSelfAndSign', () => {
    it('should create and sign a self permit', async () => {
      const options: CreateSelfPermitOptions = {
        issuer: bobAddress,
        name: 'Test Permit',
      };

      const permit = await PermitUtils.createSelfAndSign(options, publicClient, bobWalletClient);

      expect(permit.type).toBe('self');
      expect(permit.issuerSignature).toBeDefined();
      expect(permit.issuerSignature).not.toBe('0x');
      expect(permit.recipientSignature).toBe('0x');
      expect(permit._signedDomain).toBeDefined();
    });
  });

  describe('createSharingAndSign', () => {
    it('should create and sign a sharing permit', async () => {
      const options: CreateSharingPermitOptions = {
        issuer: bobAddress,
        recipient: aliceAddress,
        name: 'Test Sharing Permit',
      };

      const permit = await PermitUtils.createSharingAndSign(options, publicClient, bobWalletClient);

      expect(permit.type).toBe('sharing');
      expect(permit.issuerSignature).toBeDefined();
      expect(permit.issuerSignature).not.toBe('0x');
      expect(permit.recipientSignature).toBe('0x');
      expect(permit._signedDomain).toBeDefined();
    });
  });

  describe('importSharedAndSign', () => {
    it('should import and sign a shared permit', async () => {
      const options: ImportSharedPermitOptions = {
        issuer: bobAddress,
        recipient: aliceAddress,
        issuerSignature: '0x1234567890abcdef',
        name: 'Test Import Permit',
      };

      const permit = await PermitUtils.importSharedAndSign(options, publicClient, aliceWalletClient);

      expect(permit.type).toBe('recipient');
      expect(permit.recipientSignature).toBeDefined();
      expect(permit.recipientSignature).not.toBe('0x');
      expect(permit._signedDomain).toBeDefined();
    });

    it('should import and sign a shared permit string', async () => {
      const options: ImportSharedPermitOptions = {
        issuer: bobAddress,
        recipient: aliceAddress,
        issuerSignature: '0x1234567890abcdef',
      };

      const stringOptions = JSON.stringify(options);

      const permit = await PermitUtils.importSharedAndSign(stringOptions, publicClient, aliceWalletClient);

      expect(permit.type).toBe('recipient');
      expect(permit.recipientSignature).toBeDefined();
      expect(permit.recipientSignature).not.toBe('0x');
      expect(permit._signedDomain).toBeDefined();
    });

    it('should import and sign a shared permit json object', async () => {
      const options: ImportSharedPermitOptions = {
        issuer: bobAddress,
        recipient: aliceAddress,
        issuerSignature: '0x1234567890abcdef',
      };

      const jsonOptions = JSON.parse(JSON.stringify(options));

      const permit = await PermitUtils.importSharedAndSign(jsonOptions, publicClient, aliceWalletClient);

      expect(permit.type).toBe('recipient');
      expect(permit.recipientSignature).toBeDefined();
      expect(permit.recipientSignature).not.toBe('0x');
      expect(permit._signedDomain).toBeDefined();
    });
  });

  describe('sign', () => {
    it('should sign a self permit', async () => {
      const permit = await PermitUtils.createSelf({
        issuer: bobAddress,
        name: 'Test Permit',
      });

      const signedPermit = await PermitUtils.sign(permit, publicClient, bobWalletClient);

      expect(signedPermit.type).toBe('self');
      expect(signedPermit.issuerSignature).toBeDefined();
      expect(signedPermit.issuerSignature).not.toBe('0x');
      expect(signedPermit._signedDomain).toBeDefined();
    });

    it('should sign a recipient permit', async () => {
      const permit = await PermitUtils.importShared({
        issuer: bobAddress,
        recipient: aliceAddress,
        issuerSignature: '0xexisting-signature',
        name: 'Test Permit',
      });

      const signedPermit = await PermitUtils.sign(permit, publicClient, aliceWalletClient);

      expect(signedPermit.recipientSignature).toBeDefined();
      expect(signedPermit.recipientSignature).not.toBe('0x');
      expect(signedPermit._signedDomain).toBeDefined();
    });

    it('should throw error for undefined signer', async () => {
      const permit = await PermitUtils.createSelf({
        issuer: bobAddress,
        name: 'Test Permit',
      });

      await expect(
        // @ts-expect-error - undefined signer
        PermitUtils.sign(permit, publicClient, undefined)
      ).rejects.toThrow();
    });
  });

  describe('serialize/deserialize', () => {
    it('should serialize and deserialize a permit', async () => {
      const originalPermit = await PermitUtils.createSelf({
        issuer: bobAddress,
        name: 'Test Permit',
      });

      const serialized = PermitUtils.serialize(originalPermit);
      const deserialized = PermitUtils.deserialize(serialized);

      expect(deserialized.type).toBe('self');
      expect(deserialized.name).toBe(originalPermit.name);
      expect(deserialized.type).toBe(originalPermit.type);
      expect(deserialized.issuer).toBe(originalPermit.issuer);
      expect(deserialized.sealingPair.privateKey).toBe(originalPermit.sealingPair.privateKey);
      expect(deserialized.sealingPair.publicKey).toBe(originalPermit.sealingPair.publicKey);
    });
  });

  describe('getPermission', () => {
    it('should extract permission from permit', async () => {
      const permit = await PermitUtils.createSelfAndSign(
        {
          issuer: bobAddress,
          name: 'Test Permit',
        },
        publicClient,
        bobWalletClient
      );

      const permission = PermitUtils.getPermission(permit);

      expect(permission.issuer).toBe(permit.issuer);
      expect(permission.sealingKey).toBe(`0x${permit.sealingPair.publicKey}`);
      expect(permission).not.toHaveProperty('name');
      expect(permission).not.toHaveProperty('type');
    });
  });

  describe('getHash', () => {
    it('should generate consistent hash for same permit data', async () => {
      const permit1 = await PermitUtils.createSelf({
        issuer: bobAddress,
        name: 'Test Permit',
      });

      const permit2 = await PermitUtils.createSelf({
        issuer: bobAddress,
        name: 'Test Permit',
      });

      const hash1 = PermitUtils.getHash(permit1);
      const hash2 = PermitUtils.getHash(permit2);

      expect(hash1).toBe(hash2);
    });
  });

  describe('export', () => {
    it('should export permit data without sensitive fields', async () => {
      const permit = await PermitUtils.createSelf({
        issuer: bobAddress,
        name: 'Test Permit',
      });

      const exported = PermitUtils.export(permit);
      const parsed = JSON.parse(exported);

      expect(parsed.name).toBe('Test Permit');
      expect(parsed.issuer).toBe(bobAddress);
      expect(parsed).not.toHaveProperty('sealingPair');
      expect(parsed).not.toHaveProperty('issuerSignature');
    });
  });

  describe('updateName', () => {
    it('should update permit name immutably', async () => {
      const permit = await PermitUtils.createSelf({
        issuer: bobAddress,
        name: 'Original Name',
      });

      const updatedPermit = PermitUtils.updateName(permit, 'New Name');

      expect(updatedPermit.name).toBe('New Name');
      expect(permit.name).toBe('Original Name'); // Original should be unchanged
      expect(updatedPermit).not.toBe(permit); // Should be a new object
    });
  });

  describe('validation helpers', () => {
    it('should check if permit is expired', async () => {
      const expiredPermit = await PermitUtils.createSelf({
        issuer: bobAddress,
        name: 'Test Permit',
        expiration: Math.floor(Date.now() / 1000) - 3600, // 1 hour ago
      });

      const validPermit = await PermitUtils.createSelf({
        issuer: bobAddress,
        name: 'Test Permit',
        expiration: Math.floor(Date.now() / 1000) + 3600, // 1 hour from now
      });

      expect(PermitUtils.isExpired(expiredPermit)).toBe(true);
      expect(PermitUtils.isExpired(validPermit)).toBe(false);
    });

    it('should check if permit is signed', async () => {
      const unsignedPermit = await PermitUtils.createSelf({
        issuer: bobAddress,
        name: 'Test Permit',
      });

      const signedPermit = await PermitUtils.sign(unsignedPermit, publicClient, bobWalletClient);

      expect(PermitUtils.isSigned(unsignedPermit)).toBe(false);
      expect(PermitUtils.isSigned(signedPermit)).toBe(true);
    });

    it('should check overall validity', async () => {
      const validPermit = await PermitUtils.createSelf({
        issuer: bobAddress,
        name: 'Test Permit',
        expiration: Math.floor(Date.now() / 1000) + 3600,
      });

      const signedPermit = await PermitUtils.sign(validPermit, publicClient, bobWalletClient);

      const validation = PermitUtils.isValid(signedPermit);
      expect(validation.valid).toBe(true);
      expect(validation.error).toBeNull();
    });
  });

  describe('real contract interactions', () => {
    it('should fetch EIP712 domain from real Arbitrum Sepolia contract', async () => {
      // This test uses the real public client to fetch actual contract data
      const domain = await PermitUtils.fetchEIP712Domain(publicClient);

      expect(domain).toBeDefined();
      expect(domain.name).toBeDefined();
      expect(domain.version).toBeDefined();
      expect(domain.chainId).toBeDefined();
      expect(domain.verifyingContract).toBeDefined();
      expect(domain.verifyingContract).toMatch(/^0x[a-fA-F0-9]{40}$/); // Valid Ethereum address
    }, 10000); // 10 second timeout for network call

    it('should check signed domain validity with real contract data', async () => {
      const permit = await PermitUtils.createSelf({
        type: 'self',
        issuer: bobAddress,
        name: 'Test Permit',
      });

      // Sign the permit to get a domain
      const signedPermit = await PermitUtils.sign(permit, publicClient, bobWalletClient);

      // Check if the signed domain is valid against the real contract
      const isValid = await PermitUtils.checkSignedDomainValid(signedPermit, publicClient);

      expect(typeof isValid).toBe('boolean');
    }, 10000); // 10 second timeout for network call
  });
});
