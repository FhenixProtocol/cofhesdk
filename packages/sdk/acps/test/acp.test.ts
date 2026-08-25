import { describe, it, expect, vi } from 'vitest';
import {
  ACPUtils,
  type CreateSelfACPOptions,
  type CreateSharingACPOptions,
  type ImportSharedACPOptions,
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
    it('should create a self acp with valid options', async () => {
      const options: CreateSelfACPOptions = {
        type: 'self',
        issuer: bobAddress,
        name: 'Test ACP',
      };

      const acp = ACPUtils.createSelf(options);

      expect(acp.hash).toBe(ACPUtils.getHash(acp));
      expect(acp.type).toBe('self');
      expect(acp.name).toBe('Test ACP');
      expect(acp.type).toBe('self');
      expect(acp.issuer).toBe(bobAddress);
      expect(acp.sealingPrivateKey).toBeDefined();
      expect(acp.sealingKey).toBeDefined();

      // Should not be signed yet
      expect(acp.issuerSignature).toBe('0x');
      expect(acp.recipientSignature).toBe('0x');
    });

    it('should throw error for invalid options', async () => {
      const options: CreateSelfACPOptions = {
        type: 'self',
        issuer: 'invalid-address',
        name: 'Test ACP',
      };

      expect(() => ACPUtils.createSelf(options)).toThrowError();
    });
  });

  describe('createSharing', () => {
    it('should create a sharing acp with valid options', async () => {
      const options: CreateSharingACPOptions = {
        type: 'sharing',
        issuer: bobAddress,
        recipient: aliceAddress,
        name: 'Test Sharing ACP',
      };

      const acp = ACPUtils.createSharing(options);

      expect(acp.hash).toBe(ACPUtils.getHash(acp));
      expect(acp.type).toBe('sharing');
      expect(acp.name).toBe('Test Sharing ACP');
      expect(acp.type).toBe('sharing');
      expect(acp.issuer).toBe(bobAddress);
      expect(acp.recipient).toBe(aliceAddress);
      expect(acp.sealingPrivateKey).toBeDefined();
      expect(acp.sealingKey).toBeDefined();

      // Should not be signed yet
      expect(acp.issuerSignature).toBe('0x');
      expect(acp.recipientSignature).toBe('0x');
    });

    it('should throw error for invalid recipient', async () => {
      const options: CreateSharingACPOptions = {
        type: 'sharing',
        issuer: bobAddress,
        recipient: 'invalid-address',
        name: 'Test Sharing ACP',
      };

      expect(() => ACPUtils.createSharing(options)).toThrow();
    });
  });

  describe('importShared', () => {
    it('should import a shared acp with valid options', async () => {
      const options: ImportSharedACPOptions = {
        issuer: bobAddress,
        expiration: Math.floor(Date.now() / 1000) + 3600, // 1 hour from now
        recipient: aliceAddress,
        issuerSignature: '0x1234567890abcdef',
        name: 'Test Import ACP',
      };

      const acp = ACPUtils.importShared(options);

      expect(acp.hash).toBe(ACPUtils.getHash(acp));
      expect(acp.type).toBe('recipient');
      expect(acp.name).toBe('Test Import ACP');
      expect(acp.issuer).toBe(bobAddress);
      expect(acp.recipient).toBe(aliceAddress);
      expect(acp.issuerSignature).toBe('0x1234567890abcdef');
      expect(acp.sealingPrivateKey).toBeDefined();
      expect(acp.sealingKey).toBeDefined();

      // Should not be signed yet
      expect(acp.recipientSignature).toBe('0x');
    });

    it('should import a shared acp with valid options as string', async () => {
      const options: ImportSharedACPOptions = {
        issuer: bobAddress,
        expiration: Math.floor(Date.now() / 1000) + 3600, // 1 hour from now
        recipient: aliceAddress,
        issuerSignature: '0x1234567890abcdef',
      };

      const stringOptions = JSON.stringify(options);

      const acp = ACPUtils.importShared(stringOptions);

      expect(acp.type).toBe('recipient');
    });

    it('should throw error for invalid acp type', async () => {
      const options = {
        type: 'self',
        issuer: bobAddress,
        recipient: aliceAddress,
        issuerSignature: '0x1234567890abcdef',
      } as unknown as ImportSharedACPOptions;

      expect(() => ACPUtils.importShared(options)).toThrow();

      const options2 = {
        type: 'recipient',
        issuer: bobAddress,
        recipient: aliceAddress,
        issuerSignature: '0x1234567890abcdef',
      } as unknown as ImportSharedACPOptions;

      expect(() => ACPUtils.importShared(options2)).toThrow();
    });

    it('should throw error for missing issuerSignature', async () => {
      const options: ImportSharedACPOptions = {
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
      } as unknown as ImportSharedACPOptions;
      expect(() => ACPUtils.importShared(options)).toThrow();
    });
  });

  describe('createSelfAndSign', () => {
    it('should create and sign a self acp', async () => {
      const options: CreateSelfACPOptions = {
        issuer: bobAddress,
        name: 'Test ACP',
      };

      const acp = await ACPUtils.createSelfAndSign(options, publicClient, bobWalletClient);

      expect(acp.type).toBe('self');
      expect(acp.issuerSignature).toBeDefined();
      expect(acp.issuerSignature).not.toBe('0x');
      expect(acp.recipientSignature).toBe('0x');
      expect(acp._signedDomain).toBeDefined();
    });
  });

  describe('createSharingAndSign', () => {
    it('should create and sign a sharing acp', async () => {
      const options: CreateSharingACPOptions = {
        issuer: bobAddress,
        recipient: aliceAddress,
        name: 'Test Sharing ACP',
      };

      const acp = await ACPUtils.createSharingAndSign(options, publicClient, bobWalletClient);

      expect(acp.type).toBe('sharing');
      expect(acp.issuerSignature).toBeDefined();
      expect(acp.issuerSignature).not.toBe('0x');
      expect(acp.recipientSignature).toBe('0x');
      expect(acp._signedDomain).toBeDefined();
    });
  });

  describe('importSharedAndSign', () => {
    it('should import and sign a shared acp', async () => {
      const options: ImportSharedACPOptions = {
        issuer: bobAddress,
        recipient: aliceAddress,
        expiration: Math.floor(Date.now() / 1000) + 3600, // 1 hour from now
        issuerSignature: '0x1234567890abcdef',
        name: 'Test Import ACP',
      };

      const acp = await ACPUtils.importSharedAndSign(options, publicClient, aliceWalletClient);

      expect(acp.type).toBe('recipient');
      expect(acp.recipientSignature).toBeDefined();
      expect(acp.recipientSignature).not.toBe('0x');
      expect(acp._signedDomain).toBeDefined();
    });

    it('should import and sign a shared acp string', async () => {
      const options: ImportSharedACPOptions = {
        issuer: bobAddress,
        recipient: aliceAddress,
        expiration: Math.floor(Date.now() / 1000) + 3600, // 1 hour from now
        issuerSignature: '0x1234567890abcdef',
      };

      const stringOptions = JSON.stringify(options);

      const acp = await ACPUtils.importSharedAndSign(stringOptions, publicClient, aliceWalletClient);

      expect(acp.type).toBe('recipient');
      expect(acp.recipientSignature).toBeDefined();
      expect(acp.recipientSignature).not.toBe('0x');
      expect(acp._signedDomain).toBeDefined();
    });

    it('should import and sign a shared acp json object', async () => {
      const options: ImportSharedACPOptions = {
        issuer: bobAddress,
        recipient: aliceAddress,
        expiration: Math.floor(Date.now() / 1000) + 3600, // 1 hour from now
        issuerSignature: '0x1234567890abcdef',
      };

      const jsonOptions = JSON.parse(JSON.stringify(options));

      const acp = await ACPUtils.importSharedAndSign(jsonOptions, publicClient, aliceWalletClient);

      expect(acp.type).toBe('recipient');
      expect(acp.recipientSignature).toBeDefined();
      expect(acp.recipientSignature).not.toBe('0x');
      expect(acp._signedDomain).toBeDefined();
    });
  });

  describe('sign', () => {
    it('should sign a self acp', async () => {
      const acp = ACPUtils.createSelf({
        issuer: bobAddress,
        name: 'Test ACP',
      });

      const signedACP = await ACPUtils.sign(acp, publicClient, bobWalletClient);

      expect(signedACP.type).toBe('self');
      expect(signedACP.issuerSignature).toBeDefined();
      expect(signedACP.issuerSignature).not.toBe('0x');
      expect(signedACP._signedDomain).toBeDefined();
    });

    it('should sign a recipient acp', async () => {
      const acp = ACPUtils.importShared({
        issuer: bobAddress,
        recipient: aliceAddress,
        expiration: Math.floor(Date.now() / 1000) + 3600, // 1 hour from now
        issuerSignature: '0x1111111111111111111111111111111111111111111111111111111111111111',
        name: 'Test ACP',
      });

      const signedACP = await ACPUtils.sign(acp, publicClient, aliceWalletClient);

      expect(signedACP.recipientSignature).toBeDefined();
      expect(signedACP.recipientSignature).not.toBe('0x');
      expect(signedACP._signedDomain).toBeDefined();
    });

    it('should throw error for undefined signer', async () => {
      const acp = ACPUtils.createSelf({
        issuer: bobAddress,
        name: 'Test ACP',
      });

      await expect(
        // @ts-expect-error - undefined signer
        ACPUtils.sign(acp, publicClient, undefined)
      ).rejects.toThrow();
    });
  });

  describe('serialize/deserialize', () => {
    it('should serialize and deserialize an ACP', async () => {
      const originalACP = ACPUtils.createSelf({
        issuer: bobAddress,
        name: 'Test ACP',
      });

      const serialized = ACPUtils.serialize(originalACP);
      const deserialized = ACPUtils.deserialize(serialized);

      expect(deserialized.type).toBe('self');
      expect(deserialized.name).toBe(originalACP.name);
      expect(deserialized.type).toBe(originalACP.type);
      expect(deserialized.issuer).toBe(originalACP.issuer);
      expect(deserialized.sealingPrivateKey).toBe(originalACP.sealingPrivateKey);
      expect(deserialized.sealingKey).toBe(originalACP.sealingKey);
    });
  });

  describe('getPermission', () => {
    it('should extract permission from acp', async () => {
      const acp = await ACPUtils.createSelfAndSign(
        {
          issuer: bobAddress,
          name: 'Test ACP',
        },
        publicClient,
        bobWalletClient
      );

      const permission = ACPUtils.getPublic(acp);

      expect(permission.issuer).toBe(acp.issuer);
      expect(permission.sealingKey).toBe(acp.sealingKey);
      expect(permission).not.toHaveProperty('name');
      expect(permission).not.toHaveProperty('type');
    });
  });

  describe('getHash', () => {
    it('should generate consistent hash for same acp data', async () => {
      const expiration = Math.floor(Date.now() / 1000) + 3600; // 1 hour from now
      const acp1 = ACPUtils.createSelf({
        expiration,
        issuer: bobAddress,
        name: 'Test ACP',
      });

      const acp2 = ACPUtils.createSelf({
        expiration,
        issuer: bobAddress,
        name: 'Test ACP',
      });

      expect(acp1.hash).toBe(acp2.hash);
    });
  });

  describe('export', () => {
    it('throws when exporting a non-sharing acp', async () => {
      const acp = ACPUtils.createSelf({
        issuer: bobAddress,
        name: 'Test ACP',
      });

      // export includes the issuer signature — only sharing acps are exportable
      expect(() => ACPUtils.export(acp)).toThrow(/only 'sharing' ACPs are exportable/);
    });

    it('throws when exporting an unsigned sharing acp', async () => {
      const acp = ACPUtils.createSharing({
        issuer: bobAddress,
        recipient: aliceAddress,
        name: 'Test Sharing ACP',
      });

      expect(() => ACPUtils.export(acp)).toThrow(/sign it first/);
    });

    it('should export sharing acp data with recipient and issuerSignature', async () => {
      const acp = await ACPUtils.createSharingAndSign(
        {
          issuer: bobAddress,
          recipient: aliceAddress,
          name: 'Test Sharing ACP',
        },
        publicClient,
        bobWalletClient
      );

      const exported = ACPUtils.export(acp);
      const parsed = JSON.parse(exported);

      expect(parsed.name).toBe('Test Sharing ACP');
      expect(parsed.type).toBe('sharing');
      expect(parsed.issuer).toBe(bobAddress);
      expect(parsed.recipient).toBe(aliceAddress);
      expect(parsed.issuerSignature).toBeDefined();
      expect(parsed.issuerSignature).not.toBe('0x');
      expect(parsed).not.toHaveProperty('sealingPrivateKey');
    });

    it('exports the fixed SharedACP shape — empty fields present, not omitted', async () => {
      // every zero-value field must still appear in the JSON (signature set manually
      // to pass the unsigned-export guard without touching the other defaults)
      const acp = {
        ...ACPUtils.createSharing({
          issuer: bobAddress,
          recipient: aliceAddress,
          name: 'Test Sharing ACP',
        }),
        issuerSignature: '0xsig' as `0x${string}`,
      };

      const parsed = JSON.parse(ACPUtils.export(acp));

      expect(Object.keys(parsed).sort()).toEqual(
        [
          'name',
          'type',
          'issuer',
          'expiration',
          'recipient',
          'revokerData',
          'revokerContract',
          'scope',
          'contracts',
          'handles',
          'issuerSignature',
        ].sort()
      );
      expect(parsed.issuerSignature).toBe('0xsig');
      expect(parsed.scope).toBe(0);
      expect(parsed.contracts).toEqual([]);
      expect(parsed.handles).toEqual([]);
      expect(parsed.revokerData).toBe(0);
      // private component never leaves the client
      expect(parsed).not.toHaveProperty('sealingPrivateKey');
      expect(parsed).not.toHaveProperty('sealingKey');
      expect(parsed).not.toHaveProperty('hash');
      expect(parsed).not.toHaveProperty('recipientSignature');
    });
  });

  describe('updateName', () => {
    it('should update acp name immutably', async () => {
      const acp = ACPUtils.createSelf({
        issuer: bobAddress,
        name: 'Original Name',
      });

      const updatedACP = ACPUtils.updateName(acp, 'New Name');

      expect(updatedACP.name).toBe('New Name');
      expect(acp.name).toBe('Original Name'); // Original should be unchanged
      expect(updatedACP).not.toBe(acp); // Should be a new object
    });
  });

  describe('validation helpers', () => {
    it('should check if acp is expired', async () => {
      const expiredACP = ACPUtils.createSelf({
        issuer: bobAddress,
        name: 'Test ACP',
        expiration: Math.floor(Date.now() / 1000) - 3600, // 1 hour ago
      });

      const validACP = ACPUtils.createSelf({
        issuer: bobAddress,
        name: 'Test ACP',
        expiration: Math.floor(Date.now() / 1000) + 3600, // 1 hour from now
      });

      expect(ACPUtils.isExpired(expiredACP)).toBe(true);
      expect(ACPUtils.isExpired(validACP)).toBe(false);
    });

    it('should check if acp is signed', async () => {
      const unsignedACP = ACPUtils.createSelf({
        issuer: bobAddress,
        name: 'Test ACP',
      });

      const signedACP = await ACPUtils.sign(unsignedACP, publicClient, bobWalletClient);

      expect(ACPUtils.isSigned(unsignedACP)).toBe(false);
      expect(ACPUtils.isSigned(signedACP)).toBe(true);
    });

    it('should check overall validity', async () => {
      const validACP = ACPUtils.createSelf({
        issuer: bobAddress,
        name: 'Test ACP',
        expiration: Math.floor(Date.now() / 1000) + 3600,
      });

      const signedACP = await ACPUtils.sign(validACP, publicClient, bobWalletClient);

      const validation = ACPUtils.isValid(signedACP);
      expect(validation.valid).toBe(true);
      expect(validation.error).toBeNull();
    });

    it('should throw on validate() for expired signed acp', async () => {
      const expiredACP = ACPUtils.createSelf({
        issuer: bobAddress,
        name: 'Expired ACP',
        expiration: Math.floor(Date.now() / 1000) - 3600,
      });

      const signedExpiredACP = await ACPUtils.sign(expiredACP, publicClient, bobWalletClient);
      expect(() => ACPUtils.validate(signedExpiredACP)).toThrow('ACP is expired');
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
      const acp = ACPUtils.createSelf({
        type: 'self',
        issuer: bobAddress,
        name: 'Test ACP',
      });

      // Sign the acp to get a domain
      const signedACP = await ACPUtils.sign(acp, publicClient, bobWalletClient);

      // Check if the signed domain is valid against the real contract
      const isValid = await ACPUtils.checkSignedDomainValid(signedACP, publicClient);

      expect(typeof isValid).toBe('boolean');
    }, 10000); // 10 second timeout for network call

    // TODO: Uncomment when updated ACL with checkACPValidity function is deployed

    // it('should check acp validity on chain with real contract data', async () => {
    //   const acp = ACPUtils.createSelf({
    //     type: 'self',
    //     issuer: bobAddress,
    //     name: 'Test ACP',
    //   });

    //   const signedACP = await ACPUtils.sign(acp, publicClient, bobWalletClient);

    //   const isValid = await ACPUtils.checkValidityOnChain(signedACP, publicClient);

    //   expect(typeof isValid).toBe('boolean');
    //   expect(isValid).toBe(true);

    //   const acpInvalid = ACPUtils.createSelf({
    //     type: 'self',
    //     issuer: bobAddress,
    //     name: 'Test ACP',
    //     expiration: Math.floor(Date.now() / 1000) - 3600, // 1 hour ago
    //   });

    //   const signedACPInvalid = await ACPUtils.sign(acpInvalid, publicClient, bobWalletClient);
    //   const isValidInvalid = await ACPUtils.checkValidityOnChain(signedACPInvalid, publicClient);

    //   expect(typeof isValidInvalid).toBe('boolean');
    //   expect(isValidInvalid).toBe(false);
    // });
  });
});
