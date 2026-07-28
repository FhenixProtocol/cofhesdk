import { describe, it, expect, vi } from 'vitest';
import {
  ACPUtils,
  type CreateSelfPermitOptions,
  type CreateSharingPermitOptions,
  type ImportSharedPermitOptions,
} from '../index.js';

// ACP domain resolution requires an upgraded on-chain ACL (domain ("ACL","2") served by the ACL itself).
// Public testnets still run the V2 contracts, so the domain fetch is stubbed here —
// these tests cover the signing flow, not on-chain domain resolution (which is
// exercised e2e against mocks in test/hardhat-plugin-test).
vi.mock('../onchain-utils.js', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../onchain-utils.js')>()),
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

describe('ACPUtils Tests', () => {
  describe('createSelf', () => {
    it('should create a self permit with valid options', async () => {
      const options: CreateSelfPermitOptions = {
        type: 'self',
        issuer: bobAddress,
        name: 'Test ACP',
      };

      const permit = ACPUtils.createSelf(options);

      expect(permit.hash).toBe(ACPUtils.getHash(permit));
      expect(permit.type).toBe('self');
      expect(permit.name).toBe('Test ACP');
      expect(permit.type).toBe('self');
      expect(permit.issuer).toBe(bobAddress);
      expect(permit.sealingPrivateKey).toBeDefined();
      expect(permit.sealingKey).toBeDefined();

      // Should not be signed yet
      expect(permit.issuerSignature).toBe('0x');
      expect(permit.recipientSignature).toBe('0x');
    });

    it('should throw error for invalid options', async () => {
      const options: CreateSelfPermitOptions = {
        type: 'self',
        issuer: 'invalid-address',
        name: 'Test ACP',
      };

      expect(() => ACPUtils.createSelf(options)).toThrowError();
    });
  });

  describe('createSharing', () => {
    it('should create a sharing permit with valid options', async () => {
      const options: CreateSharingPermitOptions = {
        type: 'sharing',
        issuer: bobAddress,
        recipient: aliceAddress,
        name: 'Test Sharing ACP',
      };

      const permit = ACPUtils.createSharing(options);

      expect(permit.hash).toBe(ACPUtils.getHash(permit));
      expect(permit.type).toBe('sharing');
      expect(permit.name).toBe('Test Sharing ACP');
      expect(permit.type).toBe('sharing');
      expect(permit.issuer).toBe(bobAddress);
      expect(permit.recipient).toBe(aliceAddress);
      expect(permit.sealingPrivateKey).toBeDefined();
      expect(permit.sealingKey).toBeDefined();

      // Should not be signed yet
      expect(permit.issuerSignature).toBe('0x');
      expect(permit.recipientSignature).toBe('0x');
    });

    it('should throw error for invalid recipient', async () => {
      const options: CreateSharingPermitOptions = {
        type: 'sharing',
        issuer: bobAddress,
        recipient: 'invalid-address',
        name: 'Test Sharing ACP',
      };

      expect(() => ACPUtils.createSharing(options)).toThrow();
    });
  });

  describe('importShared', () => {
    it('should import a shared permit with valid options', async () => {
      const options: ImportSharedPermitOptions = {
        issuer: bobAddress,
        expiration: Math.floor(Date.now() / 1000) + 3600, // 1 hour from now
        recipient: aliceAddress,
        issuerSignature: '0x1234567890abcdef',
        name: 'Test Import ACP',
      };

      const permit = ACPUtils.importShared(options);

      expect(permit.hash).toBe(ACPUtils.getHash(permit));
      expect(permit.type).toBe('recipient');
      expect(permit.name).toBe('Test Import ACP');
      expect(permit.issuer).toBe(bobAddress);
      expect(permit.recipient).toBe(aliceAddress);
      expect(permit.issuerSignature).toBe('0x1234567890abcdef');
      expect(permit.sealingPrivateKey).toBeDefined();
      expect(permit.sealingKey).toBeDefined();

      // Should not be signed yet
      expect(permit.recipientSignature).toBe('0x');
    });

    it('should import a shared permit with valid options as string', async () => {
      const options: ImportSharedPermitOptions = {
        issuer: bobAddress,
        expiration: Math.floor(Date.now() / 1000) + 3600, // 1 hour from now
        recipient: aliceAddress,
        issuerSignature: '0x1234567890abcdef',
      };

      const stringOptions = JSON.stringify(options);

      const permit = ACPUtils.importShared(stringOptions);

      expect(permit.type).toBe('recipient');
    });

    it('should throw error for invalid permit type', async () => {
      const options = {
        type: 'self',
        issuer: bobAddress,
        recipient: aliceAddress,
        issuerSignature: '0x1234567890abcdef',
      } as unknown as ImportSharedPermitOptions;

      expect(() => ACPUtils.importShared(options)).toThrow();

      const options2 = {
        type: 'recipient',
        issuer: bobAddress,
        recipient: aliceAddress,
        issuerSignature: '0x1234567890abcdef',
      } as unknown as ImportSharedPermitOptions;

      expect(() => ACPUtils.importShared(options2)).toThrow();
    });

    it('should throw error for missing issuerSignature', async () => {
      const options: ImportSharedPermitOptions = {
        issuer: bobAddress,
        expiration: Math.floor(Date.now() / 1000) + 3600, // 1 hour from now
        recipient: aliceAddress,
        issuerSignature: '0x', // Invalid empty signature
        name: 'Test Import ACP',
      };

      expect(() => ACPUtils.importShared(options)).toThrow();
    });

    it('should throw error for missing expiration', async () => {
      const options = {
        issuer: bobAddress,
        recipient: aliceAddress,
        issuerSignature: '0x1234567890abcdef',
      } as unknown as ImportSharedPermitOptions;
      expect(() => ACPUtils.importShared(options)).toThrow();
    });
  });

  describe('createSelfAndSign', () => {
    it('should create and sign a self permit', async () => {
      const options: CreateSelfPermitOptions = {
        issuer: bobAddress,
        name: 'Test ACP',
      };

      const permit = await ACPUtils.createSelfAndSign(options, publicClient, bobWalletClient);

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
        name: 'Test Sharing ACP',
      };

      const permit = await ACPUtils.createSharingAndSign(options, publicClient, bobWalletClient);

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
        expiration: Math.floor(Date.now() / 1000) + 3600, // 1 hour from now
        issuerSignature: '0x1234567890abcdef',
        name: 'Test Import ACP',
      };

      const permit = await ACPUtils.importSharedAndSign(options, publicClient, aliceWalletClient);

      expect(permit.type).toBe('recipient');
      expect(permit.recipientSignature).toBeDefined();
      expect(permit.recipientSignature).not.toBe('0x');
      expect(permit._signedDomain).toBeDefined();
    });

    it('should import and sign a shared permit string', async () => {
      const options: ImportSharedPermitOptions = {
        issuer: bobAddress,
        recipient: aliceAddress,
        expiration: Math.floor(Date.now() / 1000) + 3600, // 1 hour from now
        issuerSignature: '0x1234567890abcdef',
      };

      const stringOptions = JSON.stringify(options);

      const permit = await ACPUtils.importSharedAndSign(stringOptions, publicClient, aliceWalletClient);

      expect(permit.type).toBe('recipient');
      expect(permit.recipientSignature).toBeDefined();
      expect(permit.recipientSignature).not.toBe('0x');
      expect(permit._signedDomain).toBeDefined();
    });

    it('should import and sign a shared permit json object', async () => {
      const options: ImportSharedPermitOptions = {
        issuer: bobAddress,
        recipient: aliceAddress,
        expiration: Math.floor(Date.now() / 1000) + 3600, // 1 hour from now
        issuerSignature: '0x1234567890abcdef',
      };

      const jsonOptions = JSON.parse(JSON.stringify(options));

      const permit = await ACPUtils.importSharedAndSign(jsonOptions, publicClient, aliceWalletClient);

      expect(permit.type).toBe('recipient');
      expect(permit.recipientSignature).toBeDefined();
      expect(permit.recipientSignature).not.toBe('0x');
      expect(permit._signedDomain).toBeDefined();
    });
  });

  describe('sign', () => {
    it('should sign a self permit', async () => {
      const permit = ACPUtils.createSelf({
        issuer: bobAddress,
        name: 'Test ACP',
      });

      const signedPermit = await ACPUtils.sign(permit, publicClient, bobWalletClient);

      expect(signedPermit.type).toBe('self');
      expect(signedPermit.issuerSignature).toBeDefined();
      expect(signedPermit.issuerSignature).not.toBe('0x');
      expect(signedPermit._signedDomain).toBeDefined();
    });

    it('should sign a recipient permit', async () => {
      const permit = ACPUtils.importShared({
        issuer: bobAddress,
        recipient: aliceAddress,
        expiration: Math.floor(Date.now() / 1000) + 3600, // 1 hour from now
        issuerSignature: '0x1111111111111111111111111111111111111111111111111111111111111111',
        name: 'Test ACP',
      });

      const signedPermit = await ACPUtils.sign(permit, publicClient, aliceWalletClient);

      expect(signedPermit.recipientSignature).toBeDefined();
      expect(signedPermit.recipientSignature).not.toBe('0x');
      expect(signedPermit._signedDomain).toBeDefined();
    });

    it('should throw error for undefined signer', async () => {
      const permit = ACPUtils.createSelf({
        issuer: bobAddress,
        name: 'Test ACP',
      });

      await expect(
        // @ts-expect-error - undefined signer
        ACPUtils.sign(permit, publicClient, undefined)
      ).rejects.toThrow();
    });
  });

  describe('serialize/deserialize', () => {
    it('should serialize and deserialize a permit', async () => {
      const originalPermit = ACPUtils.createSelf({
        issuer: bobAddress,
        name: 'Test ACP',
      });

      const serialized = ACPUtils.serialize(originalPermit);
      const deserialized = ACPUtils.deserialize(serialized);

      expect(deserialized.type).toBe('self');
      expect(deserialized.name).toBe(originalPermit.name);
      expect(deserialized.type).toBe(originalPermit.type);
      expect(deserialized.issuer).toBe(originalPermit.issuer);
      expect(deserialized.sealingPrivateKey).toBe(originalPermit.sealingPrivateKey);
      expect(deserialized.sealingKey).toBe(originalPermit.sealingKey);
    });
  });

  describe('getPermission', () => {
    it('should extract permission from permit', async () => {
      const permit = await ACPUtils.createSelfAndSign(
        {
          issuer: bobAddress,
          name: 'Test ACP',
        },
        publicClient,
        bobWalletClient
      );

      const permission = ACPUtils.getPublic(permit);

      expect(permission.issuer).toBe(permit.issuer);
      expect(permission.sealingKey).toBe(permit.sealingKey);
      expect(permission).not.toHaveProperty('name');
      expect(permission).not.toHaveProperty('type');
    });
  });

  describe('getHash', () => {
    it('should generate consistent hash for same permit data', async () => {
      const expiration = Math.floor(Date.now() / 1000) + 3600; // 1 hour from now
      const permit1 = ACPUtils.createSelf({
        expiration,
        issuer: bobAddress,
        name: 'Test ACP',
      });

      const permit2 = ACPUtils.createSelf({
        expiration,
        issuer: bobAddress,
        name: 'Test ACP',
      });

      expect(permit1.hash).toBe(permit2.hash);
    });
  });

  describe('export', () => {
    it('should export permit data without sensitive fields', async () => {
      const permit = ACPUtils.createSelf({
        issuer: bobAddress,
        name: 'Test ACP',
      });

      const exported = ACPUtils.export(permit);
      const parsed = JSON.parse(exported);

      expect(parsed.name).toBe('Test ACP');
      expect(parsed.issuer).toBe(bobAddress);
      expect(parsed).not.toHaveProperty('sealingPrivateKey');
      expect(parsed).not.toHaveProperty('issuerSignature');
    });

    it('should export sharing permit data with recipient and issuerSignature', async () => {
      const permit = await ACPUtils.createSharingAndSign(
        {
          issuer: bobAddress,
          recipient: aliceAddress,
          name: 'Test Sharing ACP',
        },
        publicClient,
        bobWalletClient
      );

      const exported = ACPUtils.export(permit);
      const parsed = JSON.parse(exported);

      expect(parsed.name).toBe('Test Sharing ACP');
      expect(parsed.type).toBe('sharing');
      expect(parsed.issuer).toBe(bobAddress);
      expect(parsed.recipient).toBe(aliceAddress);
      expect(parsed.issuerSignature).toBeDefined();
      expect(parsed.issuerSignature).not.toBe('0x');
      expect(parsed).not.toHaveProperty('sealingPrivateKey');
    });
  });

  describe('updateName', () => {
    it('should update permit name immutably', async () => {
      const permit = ACPUtils.createSelf({
        issuer: bobAddress,
        name: 'Original Name',
      });

      const updatedPermit = ACPUtils.updateName(permit, 'New Name');

      expect(updatedPermit.name).toBe('New Name');
      expect(permit.name).toBe('Original Name'); // Original should be unchanged
      expect(updatedPermit).not.toBe(permit); // Should be a new object
    });
  });

  describe('validation helpers', () => {
    it('should check if permit is expired', async () => {
      const expiredPermit = ACPUtils.createSelf({
        issuer: bobAddress,
        name: 'Test ACP',
        expiration: Math.floor(Date.now() / 1000) - 3600, // 1 hour ago
      });

      const validPermit = ACPUtils.createSelf({
        issuer: bobAddress,
        name: 'Test ACP',
        expiration: Math.floor(Date.now() / 1000) + 3600, // 1 hour from now
      });

      expect(ACPUtils.isExpired(expiredPermit)).toBe(true);
      expect(ACPUtils.isExpired(validPermit)).toBe(false);
    });

    it('should check if permit is signed', async () => {
      const unsignedPermit = ACPUtils.createSelf({
        issuer: bobAddress,
        name: 'Test ACP',
      });

      const signedPermit = await ACPUtils.sign(unsignedPermit, publicClient, bobWalletClient);

      expect(ACPUtils.isSigned(unsignedPermit)).toBe(false);
      expect(ACPUtils.isSigned(signedPermit)).toBe(true);
    });

    it('should check overall validity', async () => {
      const validPermit = ACPUtils.createSelf({
        issuer: bobAddress,
        name: 'Test ACP',
        expiration: Math.floor(Date.now() / 1000) + 3600,
      });

      const signedPermit = await ACPUtils.sign(validPermit, publicClient, bobWalletClient);

      const validation = ACPUtils.isValid(signedPermit);
      expect(validation.valid).toBe(true);
      expect(validation.error).toBeNull();
    });

    it('should throw on validate() for expired signed permit', async () => {
      const expiredPermit = ACPUtils.createSelf({
        issuer: bobAddress,
        name: 'Expired ACP',
        expiration: Math.floor(Date.now() / 1000) - 3600,
      });

      const signedExpiredPermit = await ACPUtils.sign(expiredPermit, publicClient, bobWalletClient);
      expect(() => ACPUtils.validate(signedExpiredPermit)).toThrow('ACP is expired');
    });
  });

  describe('real contract interactions', () => {
    it('should fetch EIP712 domain from real Arbitrum Sepolia contract', async () => {
      // This test uses the real public client to fetch actual contract data
      const domain = await ACPUtils.fetchEIP712Domain(publicClient);

      expect(domain).toBeDefined();
      expect(domain.name).toBeDefined();
      expect(domain.version).toBeDefined();
      expect(domain.chainId).toBeDefined();
      expect(domain.verifyingContract).toBeDefined();
      expect(domain.verifyingContract).toMatch(/^0x[a-fA-F0-9]{40}$/); // Valid Ethereum address
    }, 10000); // 10 second timeout for network call

    it('should check signed domain validity with real contract data', async () => {
      const permit = ACPUtils.createSelf({
        type: 'self',
        issuer: bobAddress,
        name: 'Test ACP',
      });

      // Sign the permit to get a domain
      const signedPermit = await ACPUtils.sign(permit, publicClient, bobWalletClient);

      // Check if the signed domain is valid against the real contract
      const isValid = await ACPUtils.checkSignedDomainValid(signedPermit, publicClient);

      expect(typeof isValid).toBe('boolean');
    }, 10000); // 10 second timeout for network call

    // TODO: Uncomment when updated ACL with checkPermitValidity function is deployed

    // it('should check permit validity on chain with real contract data', async () => {
    //   const permit = ACPUtils.createSelf({
    //     type: 'self',
    //     issuer: bobAddress,
    //     name: 'Test ACP',
    //   });

    //   const signedPermit = await ACPUtils.sign(permit, publicClient, bobWalletClient);

    //   const isValid = await ACPUtils.checkValidityOnChain(signedPermit, publicClient);

    //   expect(typeof isValid).toBe('boolean');
    //   expect(isValid).toBe(true);

    //   const permitInvalid = ACPUtils.createSelf({
    //     type: 'self',
    //     issuer: bobAddress,
    //     name: 'Test ACP',
    //     expiration: Math.floor(Date.now() / 1000) - 3600, // 1 hour ago
    //   });

    //   const signedPermitInvalid = await ACPUtils.sign(permitInvalid, publicClient, bobWalletClient);
    //   const isValidInvalid = await ACPUtils.checkValidityOnChain(signedPermitInvalid, publicClient);

    //   expect(typeof isValidInvalid).toBe('boolean');
    //   expect(isValidInvalid).toBe(false);
    // });
  });
});
