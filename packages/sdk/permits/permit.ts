import { keccak256, toHex, zeroAddress, parseAbi, type Hex, type PublicClient, type WalletClient } from 'viem';
import {
  type ACP,
  type SelfPermit,
  type SharingPermit,
  type RecipientPermit,
  type CreateSelfPermitOptions,
  type CreateSharingPermitOptions,
  type ImportSharedPermitOptions,
  type SerializedPermit,
  type EIP712Domain,
  type ACPPublic,
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
import { SignatureUtils } from './signature.js';
import { GenerateSealingKey, unsealWithPrivateKey } from './sealing.js';
import { checkPermitValidityOnChain, getAclEIP712Domain } from './onchain-utils.js';

/**
 * Main ACP utilities - functional approach for React compatibility
 */
export const ACPUtils = {
  /**
   * Create a self permit for personal use
   */
  createSelf: (options: CreateSelfPermitOptions): SelfPermit => {
    const validation = validateSelfPermitOptions(options);

    // Always generate a new sealing key - users cannot provide their own
    const sealingPair = GenerateSealingKey();

    const permit = {
      hash: ACPUtils.getHash(validation),
      ...validation,
      sealingPrivateKey: `0x${sealingPair.privateKey}` as Hex,
      sealingKey: `0x${sealingPair.publicKey}` as Hex,
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
      hash: ACPUtils.getHash(validation),
      ...validation,
      sealingPrivateKey: `0x${sealingPair.privateKey}` as Hex,
      sealingKey: `0x${sealingPair.publicKey}` as Hex,
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
      hash: ACPUtils.getHash(validation),
      ...validation,
      sealingPrivateKey: `0x${sealingPair.privateKey}` as Hex,
      sealingKey: `0x${sealingPair.publicKey}` as Hex,
      _signedDomain: undefined,
    } satisfies RecipientPermit;

    return permit;
  },

  /**
   * Sign a permit with the provided wallet client
   */
  sign: async <T extends ACP>(permit: T, publicClient: PublicClient, walletClient: WalletClient): Promise<T> => {
    if (walletClient == null || walletClient.account == null) {
      throw new Error(
        'Missing walletClient, you must pass in a `walletClient` for the connected user to create a permit signature'
      );
    }

    const primaryType = SignatureUtils.getPrimaryType(permit.type);
    const domain = await getAclEIP712Domain(publicClient);
    const { types, message } = SignatureUtils.getSignatureParams(ACPUtils.getPublic(permit, true), primaryType);

    const signature = await walletClient.signTypedData({
      domain,
      types,
      primaryType,
      message,
      account: walletClient.account,
    });

    let updatedPermit: ACP;
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
    const permit = ACPUtils.createSelf(options);
    return ACPUtils.sign(permit, publicClient, walletClient);
  },

  /**
   * Create and sign a sharing permit in one operation
   */
  createSharingAndSign: async (
    options: CreateSharingPermitOptions,
    publicClient: PublicClient,
    walletClient: WalletClient
  ): Promise<SharingPermit> => {
    const permit = ACPUtils.createSharing(options);
    return ACPUtils.sign(permit, publicClient, walletClient);
  },

  /**
   * Import and sign a shared permit in one operation from various input formats
   */
  importSharedAndSign: async (
    options: ImportSharedPermitOptions | string,
    publicClient: PublicClient,
    walletClient: WalletClient
  ): Promise<RecipientPermit> => {
    const permit = ACPUtils.importShared(options);
    return ACPUtils.sign(permit, publicClient, walletClient);
  },

  /**
   * Deserialize a permit from serialized data
   */
  deserialize: (data: SerializedPermit): ACP => {
    return { ...data };
  },

  /**
   * Serialize a permit for storage
   */
  serialize: (permit: ACP): SerializedPermit => {
    return {
      hash: permit.hash,
      name: permit.name,
      type: permit.type,
      issuer: permit.issuer,
      expiration: permit.expiration,
      recipient: permit.recipient,
      revokerData: permit.revokerData,
      revokerContract: permit.revokerContract,
      scope: permit.scope,
      contracts: permit.contracts,
      handles: permit.handles,
      sealingKey: permit.sealingKey,
      issuerSignature: permit.issuerSignature,
      recipientSignature: permit.recipientSignature,
      _signedDomain: permit._signedDomain,
      sealingPrivateKey: permit.sealingPrivateKey,
    };
  },

  /**
   * Validate a permit (schema-level validation)
   */
  validateSchema: (permit: ACP) => {
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
   * Validate a permit (holistic validation).
   *
   * This validates:
   * - ACP schema (shape + invariants)
   * - ACP is signed
   * - ACP is not expired
   *
   * For schema-only validation, use `validateSchema(permit)`.
   */
  validate: (permit: ACP) => {
    const validated = ACPUtils.validateSchema(permit);
    ValidationUtils.assertSignedAndNotExpired(validated as ACP);
    return validated;
  },

  /**
   * Get the public component of an ACP — the signed struct sent on-chain / to the decryption backend.
   * Strips the private component (hash, name, type, sealing pair).
   */
  getPublic: (permit: ACP, skipValidation = false): ACPPublic => {
    if (!skipValidation) {
      ACPUtils.validateSchema(permit);
    }

    return {
      issuer: permit.issuer,
      expiration: permit.expiration,
      recipient: permit.recipient,
      revokerData: permit.revokerData,
      revokerContract: permit.revokerContract,
      scope: permit.scope,
      contracts: permit.contracts,
      handles: permit.handles,
      sealingKey: permit.sealingKey,
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
      revokerData: permit.revokerData,
      revokerContract: permit.revokerContract,
      scope: permit.scope,
      contracts: permit.contracts,
      handles: permit.handles,
    });
    return keccak256(toHex(data));
  },

  /**
   * Export permit data for sharing (removes sensitive fields)
   */
  export: (permit: ACP): string => {
    const cleanedPermit: Record<string, unknown> = {
      name: permit.name,
      type: permit.type,
      issuer: permit.issuer,
      expiration: permit.expiration,
    };

    if (permit.recipient !== zeroAddress) cleanedPermit.recipient = permit.recipient;
    if (permit.revokerData !== 0) cleanedPermit.revokerData = permit.revokerData;
    if (permit.revokerContract !== zeroAddress) cleanedPermit.revokerContract = permit.revokerContract;
    // scope fields are part of the issuer signature — the recipient needs them to reconstruct it
    cleanedPermit.scope = permit.scope;
    if (permit.contracts.length > 0) cleanedPermit.contracts = permit.contracts;
    if (permit.handles.length > 0) cleanedPermit.handles = permit.handles;
    if (permit.type === 'sharing' && permit.issuerSignature !== '0x')
      cleanedPermit.issuerSignature = permit.issuerSignature;

    return JSON.stringify(cleanedPermit, undefined, 2);
  },

  /**
   * Unseal encrypted data using the permit's sealing key
   */
  unseal: (permit: ACP, ciphertext: EthEncryptedData): bigint => {
    return unsealWithPrivateKey(permit.sealingPrivateKey, ciphertext);
  },

  /**
   * Check if permit is expired
   */
  isExpired: (permit: ACP): boolean => {
    return ValidationUtils.isExpired(permit);
  },

  /**
   * Check if permit is signed
   */
  isSigned: (permit: ACP): boolean => {
    return ValidationUtils.isSigned(permit);
  },

  /**
   * Check if permit is signed and not expired
   */
  isSignedAndNotExpired: (permit: ACP) => {
    return ValidationUtils.isSignedAndNotExpired(permit);
  },

  /**
   * Assert that permit is signed and not expired
   */
  assertSignedAndNotExpired: (permit: ACP): void => {
    return ValidationUtils.assertSignedAndNotExpired(permit);
  },

  isValid: (permit: ACP) => {
    return ValidationUtils.isValid(permit);
  },

  /**
   * Update permit name (returns new permit instance)
   */
  updateName: (permit: ACP, name: string): ACP => {
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
  matchesDomain: (permit: ACP, domain: EIP712Domain): boolean => {
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
  checkSignedDomainValid: async (permit: ACP, publicClient: PublicClient): Promise<boolean> => {
    if (permit._signedDomain == null) return false;
    const domain = await getAclEIP712Domain(publicClient);
    return ACPUtils.matchesDomain(permit, domain);
  },

  /**
   * Check if permit passes the on-chain validation
   */
  checkValidityOnChain: async (permit: ACP, publicClient: PublicClient): Promise<boolean> => {
    const acp = ACPUtils.getPublic(permit);
    return checkPermitValidityOnChain(acp, publicClient);
  },
};
