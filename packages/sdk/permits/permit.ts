import { keccak256, toHex, zeroAddress, parseAbi, type PublicClient, type WalletClient } from 'viem';
import {
  type Permit,
  type SelfPermit,
  type SharingPermit,
  type RecipientPermit,
  type CreateSelfPermitOptions,
  type CreateSharingPermitOptions,
  type ImportSharedPermitOptions,
  type SerializedPermit,
  type EIP712Domain,
  type Permission,
  type EthEncryptedData,
  type PermitHashFields,
} from './types.js';
import {
  validateSelfPermitOptions,
  validateSharingPermitOptions,
  validateImportPermitOptions,
  validateSelfPermit,
  validateSharingPermit,
  validateImportPermit,
  ValidationUtils,
} from './validation.js';
import * as z from 'zod';
import { SignatureUtils } from './signature.js';
import { GenerateSealingKey, SealingKey } from './sealing.js';
import { checkPermitValidityOnChain, getAclEIP712Domain } from './onchain-utils.js';

/**
 * Main Permit utilities - functional approach for React compatibility
 */
export const PermitUtils = {
  /**
   * Create a self permit for personal use
   */
  createSelf: (options: CreateSelfPermitOptions): SelfPermit => {
    const validation = validateSelfPermitOptions(options);

    // Always generate a new sealing key - users cannot provide their own
    const sealingPair = GenerateSealingKey();

    const permit = {
      hash: PermitUtils.getHash(validation),
      ...validation,
      sealingPair,
      _signedDomain: undefined,
    } satisfies SelfPermit;

    return permit;
  },

  /**
   * Create a sharing permit to be shared with another user
   */
  createSharing: (options: CreateSharingPermitOptions): SharingPermit => {
    const validation = validateSharingPermitOptions(options);

    // Always generate a new sealing key - users cannot provide their own
    const sealingPair = GenerateSealingKey();

    const permit = {
      hash: PermitUtils.getHash(validation),
      ...validation,
      sealingPair,
      _signedDomain: undefined,
    } satisfies SharingPermit;

    return permit;
  },

  /**
   * Import a shared permit from various input formats
   */
  importShared: (options: ImportSharedPermitOptions | string): RecipientPermit => {
    let parsedOptions: ImportSharedPermitOptions;

    // Handle different input types
    if (typeof options === 'string') {
      // Parse JSON string
      try {
        parsedOptions = JSON.parse(options);
      } catch (error) {
        throw new Error(`Failed to parse JSON string: ${error}`);
      }
    } else if (typeof options === 'object' && options !== null) {
      // Handle both ImportSharedPermitOptions and any object
      parsedOptions = options;
    } else {
      throw new Error('Invalid input type, expected ImportSharedPermitOptions, object, or string');
    }

    // Validate type if provided
    if (parsedOptions.type != null && parsedOptions.type !== 'sharing') {
      throw new Error(`Invalid permit type <${parsedOptions.type}>, must be "sharing"`);
    }

    const validation = validateImportPermitOptions({ ...parsedOptions, type: 'recipient' });

    // Always generate a new sealing key - users cannot provide their own
    const sealingPair = GenerateSealingKey();

    const permit = {
      hash: PermitUtils.getHash(validation),
      ...validation,
      sealingPair,
      _signedDomain: undefined,
    } satisfies RecipientPermit;

    return permit;
  },

  /**
   * Sign a permit with the provided wallet client
   */
  sign: async <T extends Permit>(permit: T, publicClient: PublicClient, walletClient: WalletClient): Promise<T> => {
    if (walletClient == null || walletClient.account == null) {
      throw new Error(
        'Missing walletClient, you must pass in a `walletClient` for the connected user to create a permit signature'
      );
    }

    const primaryType = SignatureUtils.getPrimaryType(permit.type);
    const domain = await getAclEIP712Domain(publicClient);
    const { types, message } = SignatureUtils.getSignatureParams(PermitUtils.getPermission(permit, true), primaryType);

    const signature = await walletClient.signTypedData({
      domain,
      types,
      primaryType,
      message,
      account: walletClient.account,
    });

    let updatedPermit: Permit;
    if (permit.type === 'self' || permit.type === 'sharing') {
      updatedPermit = {
        ...permit,
        issuerSignature: signature,
        _signedDomain: domain,
      };
    } else {
      updatedPermit = {
        ...permit,
        recipientSignature: signature,
        _signedDomain: domain,
      };
    }

    return updatedPermit as T;
  },

  /**
   * Create and sign a self permit in one operation
   */
  createSelfAndSign: async (
    options: CreateSelfPermitOptions,
    publicClient: PublicClient,
    walletClient: WalletClient
  ): Promise<SelfPermit> => {
    const permit = PermitUtils.createSelf(options);
    return PermitUtils.sign(permit, publicClient, walletClient);
  },

  /**
   * Create and sign a sharing permit in one operation
   */
  createSharingAndSign: async (
    options: CreateSharingPermitOptions,
    publicClient: PublicClient,
    walletClient: WalletClient
  ): Promise<SharingPermit> => {
    const permit = PermitUtils.createSharing(options);
    return PermitUtils.sign(permit, publicClient, walletClient);
  },

  /**
   * Import and sign a shared permit in one operation from various input formats
   */
  importSharedAndSign: async (
    options: ImportSharedPermitOptions | string,
    publicClient: PublicClient,
    walletClient: WalletClient
  ): Promise<RecipientPermit> => {
    const permit = PermitUtils.importShared(options);
    return PermitUtils.sign(permit, publicClient, walletClient);
  },

  /**
   * Deserialize a permit from serialized data
   */
  deserialize: (data: SerializedPermit): Permit => {
    return {
      ...data,
      sealingPair: SealingKey.deserialize(data.sealingPair.privateKey, data.sealingPair.publicKey),
    };
  },

  /**
   * Serialize a permit for storage
   */
  serialize: (permit: Permit): SerializedPermit => {
    return {
      hash: permit.hash,
      name: permit.name,
      type: permit.type,
      issuer: permit.issuer,
      expiration: permit.expiration,
      recipient: permit.recipient,
      validatorId: permit.validatorId,
      validatorContract: permit.validatorContract,
      issuerSignature: permit.issuerSignature,
      recipientSignature: permit.recipientSignature,
      _signedDomain: permit._signedDomain,
      sealingPair: permit.sealingPair.serialize(),
    };
  },

  /**
   * Validate a permit
   */
  validate: (permit: Permit) => {
    if (permit.type === 'self') {
      return validateSelfPermit(permit);
    } else if (permit.type === 'sharing') {
      return validateSharingPermit(permit);
    } else if (permit.type === 'recipient') {
      return validateImportPermit(permit);
    } else {
      throw new Error('Invalid permit type');
    }
  },

  /**
   * Get the permission object from a permit (for use in contracts)
   */
  getPermission: (permit: Permit, skipValidation = false): Permission => {
    if (!skipValidation) {
      PermitUtils.validate(permit);
    }

    return {
      issuer: permit.issuer,
      expiration: permit.expiration,
      recipient: permit.recipient,
      validatorId: permit.validatorId,
      validatorContract: permit.validatorContract,
      sealingKey: `0x${permit.sealingPair.publicKey}`,
      issuerSignature: permit.issuerSignature,
      recipientSignature: permit.recipientSignature,
    };
  },

  /**
   * Get a stable hash for the permit (used as key in storage)
   */
  getHash: (permit: PermitHashFields): string => {
    const data = JSON.stringify({
      type: permit.type,
      issuer: permit.issuer,
      expiration: permit.expiration,
      recipient: permit.recipient,
      validatorId: permit.validatorId,
      validatorContract: permit.validatorContract,
    });
    return keccak256(toHex(data));
  },

  /**
   * Export permit data for sharing (removes sensitive fields)
   */
  export: (permit: Permit): string => {
    const cleanedPermit: Record<string, unknown> = {
      name: permit.name,
      type: permit.type,
      issuer: permit.issuer,
      expiration: permit.expiration,
    };

    if (permit.recipient !== zeroAddress) cleanedPermit.recipient = permit.recipient;
    if (permit.validatorId !== 0) cleanedPermit.validatorId = permit.validatorId;
    if (permit.validatorContract !== zeroAddress) cleanedPermit.validatorContract = permit.validatorContract;
    if (permit.type === 'sharing' && permit.issuerSignature !== '0x')
      cleanedPermit.issuerSignature = permit.issuerSignature;

    return JSON.stringify(cleanedPermit, undefined, 2);
  },

  /**
   * Unseal encrypted data using the permit's sealing key
   */
  unseal: (permit: Permit, ciphertext: EthEncryptedData): bigint => {
    return permit.sealingPair.unseal(ciphertext);
  },

  /**
   * Check if permit is expired
   */
  isExpired: (permit: Permit): boolean => {
    return ValidationUtils.isExpired(permit);
  },

  /**
   * Check if permit is signed
   */
  isSigned: (permit: Permit): boolean => {
    return ValidationUtils.isSigned(permit);
  },

  /**
   * Check if permit is valid
   */
  isValid: (permit: Permit) => {
    return ValidationUtils.isValid(permit);
  },

  /**
   * Update permit name (returns new permit instance)
   */
  updateName: (permit: Permit, name: string): Permit => {
    return { ...permit, name };
  },

  /**
   * Fetch EIP712 domain from the blockchain
   */
  fetchEIP712Domain: async (publicClient: PublicClient): Promise<EIP712Domain> => {
    return getAclEIP712Domain(publicClient);
  },

  /**
   * Check if permit's signed domain matches the provided domain
   */
  matchesDomain: (permit: Permit, domain: EIP712Domain): boolean => {
    return (
      permit._signedDomain?.name === domain.name &&
      permit._signedDomain?.version === domain.version &&
      permit._signedDomain?.verifyingContract === domain.verifyingContract &&
      permit._signedDomain?.chainId === domain.chainId
    );
  },

  /**
   * Check if permit's signed domain is valid for the current chain
   */
  checkSignedDomainValid: async (permit: Permit, publicClient: PublicClient): Promise<boolean> => {
    if (permit._signedDomain == null) return false;
    const domain = await getAclEIP712Domain(publicClient);
    return PermitUtils.matchesDomain(permit, domain);
  },

  /**
   * Check if permit passes the on-chain validation
   */
  checkValidityOnChain: async (permit: Permit, publicClient: PublicClient): Promise<boolean> => {
    const permission = PermitUtils.getPermission(permit);
    return checkPermitValidityOnChain(permission, publicClient);
  },
};
