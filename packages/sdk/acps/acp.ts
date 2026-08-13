import { keccak256, toHex, zeroAddress, parseAbi, type Hex, type PublicClient, type WalletClient } from 'viem';
import {
  type ACP,
  type SelfACP,
  type SharingACP,
  type RecipientACP,
  type CreateSelfACPOptions,
  type CreateSharingACPOptions,
  type ImportSharedACPOptions,
  type SharedACP,
  type SerializedACP,
  type EIP712Domain,
  type ACPPublic,
  type EthEncryptedData,
  type ACPHashFields,
} from './types.js';
import {
  validateSelfACPOptions,
  validateSharingACPOptions,
  validateImportACPOptions,
  validateSelfACP,
  validateSharingACP,
  validateImportACP,
  ValidationUtils,
} from './validation.js';
import { SignatureUtils } from './signature.js';
import { GenerateSealingKey, unsealWithPrivateKey } from './sealing.js';
import { checkACPValidityOnChain, getAclEIP712Domain } from './onchain-utils.js';

/**
 * Main ACP utilities - functional approach for React compatibility
 */
export const ACPUtils = {
  /**
   * Create a self acp for personal use
   */
  createSelf: (options: CreateSelfACPOptions): SelfACP => {
    const validation = validateSelfACPOptions(options);

    // Always generate a new sealing key - users cannot provide their own
    const sealingPair = GenerateSealingKey();

    const acp = {
      hash: ACPUtils.getHash(validation),
      ...validation,
      sealingPrivateKey: sealingPair.privateKey,
      sealingKey: sealingPair.publicKey,
      _signedDomain: undefined,
    } satisfies SelfACP;

    return acp;
  },

  /**
   * Create a sharing acp to be shared with another user
   */
  createSharing: (options: CreateSharingACPOptions): SharingACP => {
    const validation = validateSharingACPOptions(options);

    // Always generate a new sealing key - users cannot provide their own
    const sealingPair = GenerateSealingKey();

    const acp = {
      hash: ACPUtils.getHash(validation),
      ...validation,
      sealingPrivateKey: sealingPair.privateKey,
      sealingKey: sealingPair.publicKey,
      _signedDomain: undefined,
    } satisfies SharingACP;

    return acp;
  },

  /**
   * Import a shared acp from various input formats
   */
  importShared: (options: ImportSharedACPOptions | string): RecipientACP => {
    let parsedOptions: ImportSharedACPOptions;

    // Handle different input types
    if (typeof options === 'string') {
      // Parse JSON string
      try {
        parsedOptions = JSON.parse(options);
      } catch (error) {
        throw new Error(`Failed to parse JSON string: ${error}`);
      }
    } else if (typeof options === 'object' && options !== null) {
      // Handle both ImportSharedACPOptions and any object
      parsedOptions = options;
    } else {
      throw new Error('Invalid input type, expected ImportSharedACPOptions, object, or string');
    }

    // Validate type if provided
    if (parsedOptions.type != null && parsedOptions.type !== 'sharing') {
      throw new Error(`Invalid acp type <${parsedOptions.type}>, must be "sharing"`);
    }

    const validation = validateImportACPOptions({ ...parsedOptions, type: 'recipient' });

    // Always generate a new sealing key - users cannot provide their own
    const sealingPair = GenerateSealingKey();

    const acp = {
      hash: ACPUtils.getHash(validation),
      ...validation,
      sealingPrivateKey: sealingPair.privateKey,
      sealingKey: sealingPair.publicKey,
      _signedDomain: undefined,
    } satisfies RecipientACP;

    return acp;
  },

  /**
   * Sign a acp with the provided wallet client
   */
  sign: async <T extends ACP>(acp: T, publicClient: PublicClient, walletClient: WalletClient): Promise<T> => {
    if (walletClient == null || walletClient.account == null) {
      throw new Error(
        'Missing walletClient, you must pass in a `walletClient` for the connected user to create a acp signature'
      );
    }

    const primaryType = SignatureUtils.getPrimaryType(acp.type);
    const domain = await getAclEIP712Domain(publicClient);
    const { types, message } = SignatureUtils.getSignatureParams(ACPUtils.getPublic(acp, true), primaryType);

    const signature = await walletClient.signTypedData({
      domain,
      types,
      primaryType,
      message,
      account: walletClient.account,
    });

    let updatedACP: ACP;
    if (acp.type === 'self' || acp.type === 'sharing') {
      updatedACP = {
        ...acp,
        issuerSignature: signature,
        _signedDomain: domain,
      };
    } else {
      updatedACP = {
        ...acp,
        recipientSignature: signature,
        _signedDomain: domain,
      };
    }

    return updatedACP as T;
  },

  /**
   * Create and sign a self acp in one operation
   */
  createSelfAndSign: async (
    options: CreateSelfACPOptions,
    publicClient: PublicClient,
    walletClient: WalletClient
  ): Promise<SelfACP> => {
    const acp = ACPUtils.createSelf(options);
    return ACPUtils.sign(acp, publicClient, walletClient);
  },

  /**
   * Create and sign a sharing acp in one operation
   */
  createSharingAndSign: async (
    options: CreateSharingACPOptions,
    publicClient: PublicClient,
    walletClient: WalletClient
  ): Promise<SharingACP> => {
    const acp = ACPUtils.createSharing(options);
    return ACPUtils.sign(acp, publicClient, walletClient);
  },

  /**
   * Import and sign a shared acp in one operation from various input formats
   */
  importSharedAndSign: async (
    options: ImportSharedACPOptions | string,
    publicClient: PublicClient,
    walletClient: WalletClient
  ): Promise<RecipientACP> => {
    const acp = ACPUtils.importShared(options);
    return ACPUtils.sign(acp, publicClient, walletClient);
  },

  /**
   * Deserialize a acp from serialized data
   */
  deserialize: (data: SerializedACP): ACP => {
    return { ...data };
  },

  /**
   * Serialize a acp for storage
   */
  serialize: (acp: ACP): SerializedACP => {
    return {
      hash: acp.hash,
      name: acp.name,
      type: acp.type,
      issuer: acp.issuer,
      expiration: acp.expiration,
      recipient: acp.recipient,
      revokerData: acp.revokerData,
      revokerContract: acp.revokerContract,
      scope: acp.scope,
      contracts: acp.contracts,
      handles: acp.handles,
      sealingKey: acp.sealingKey,
      issuerSignature: acp.issuerSignature,
      recipientSignature: acp.recipientSignature,
      _signedDomain: acp._signedDomain,
      sealingPrivateKey: acp.sealingPrivateKey,
    };
  },

  /**
   * Validate a acp (schema-level validation)
   */
  validateSchema: (acp: ACP) => {
    if (acp.type === 'self') {
      return validateSelfACP(acp);
    } else if (acp.type === 'sharing') {
      return validateSharingACP(acp);
    } else if (acp.type === 'recipient') {
      return validateImportACP(acp);
    } else {
      throw new Error('Invalid acp type');
    }
  },

  /**
   * Validate a acp (holistic validation).
   *
   * This validates:
   * - ACP schema (shape + invariants)
   * - ACP is signed
   * - ACP is not expired
   *
   * For schema-only validation, use `validateSchema(acp)`.
   */
  validate: (acp: ACP) => {
    const validated = ACPUtils.validateSchema(acp);
    ValidationUtils.assertSignedAndNotExpired(validated as ACP);
    return validated;
  },

  /**
   * Get the public component of an ACP — the signed struct sent on-chain / to the decryption backend.
   * Strips the private component (hash, name, type, sealing pair).
   */
  getPublic: (acp: ACP, skipValidation = false): ACPPublic => {
    if (!skipValidation) {
      ACPUtils.validateSchema(acp);
    }

    return {
      issuer: acp.issuer,
      expiration: acp.expiration,
      recipient: acp.recipient,
      revokerData: acp.revokerData,
      revokerContract: acp.revokerContract,
      scope: acp.scope,
      contracts: acp.contracts,
      handles: acp.handles,
      sealingKey: acp.sealingKey,
      issuerSignature: acp.issuerSignature,
      recipientSignature: acp.recipientSignature,
    };
  },

  /**
   * Get a stable hash for the acp (used as key in storage)
   */
  getHash: (acp: ACPHashFields): string => {
    const data = JSON.stringify({
      type: acp.type,
      issuer: acp.issuer,
      expiration: acp.expiration,
      recipient: acp.recipient,
      revokerData: acp.revokerData,
      revokerContract: acp.revokerContract,
      scope: acp.scope,
      contracts: acp.contracts,
      handles: acp.handles,
    });
    return keccak256(toHex(data));
  },

  /**
   * Export acp data for sharing (strips the private component).
   * Fixed `SharedACP` shape — every field always present, aligned with
   * `ACPPublic` and the on-chain sharing payload.
   */
  export: (acp: ACP): string => {
    if (acp.type !== 'sharing') {
      throw new Error(
        `Cannot export a '${acp.type}' ACP — only 'sharing' ACPs are exportable. The export includes the issuer signature.`
      );
    }
    if (acp.issuerSignature === '0x') {
      throw new Error(
        'Cannot export an unsigned sharing ACP — sign it first (the recipient needs the issuer signature).'
      );
    }

    const shared: SharedACP = {
      name: acp.name,
      type: acp.type,
      issuer: acp.issuer,
      expiration: acp.expiration,
      recipient: acp.recipient,
      revokerData: acp.revokerData,
      revokerContract: acp.revokerContract,
      scope: acp.scope,
      contracts: acp.contracts,
      handles: acp.handles,
      issuerSignature: acp.issuerSignature,
    };

    return JSON.stringify(shared, undefined, 2);
  },

  /**
   * Unseal encrypted data using the acp's sealing key
   */
  unseal: (acp: ACP, ciphertext: EthEncryptedData): bigint => {
    return unsealWithPrivateKey(acp.sealingPrivateKey, ciphertext);
  },

  /**
   * Check if acp is expired
   */
  isExpired: (acp: ACP): boolean => {
    return ValidationUtils.isExpired(acp);
  },

  /**
   * Check if acp is signed
   */
  isSigned: (acp: ACP): boolean => {
    return ValidationUtils.isSigned(acp);
  },

  /**
   * Check if acp is signed and not expired
   */
  isSignedAndNotExpired: (acp: ACP) => {
    return ValidationUtils.isSignedAndNotExpired(acp);
  },

  /**
   * Assert that acp is signed and not expired
   */
  assertSignedAndNotExpired: (acp: ACP): void => {
    return ValidationUtils.assertSignedAndNotExpired(acp);
  },

  isValid: (acp: ACP) => {
    return ValidationUtils.isValid(acp);
  },

  /**
   * Update acp name (returns new acp instance)
   */
  updateName: (acp: ACP, name: string): ACP => {
    return { ...acp, name };
  },

  /**
   * Fetch EIP712 domain from the blockchain
   */
  fetchEIP712Domain: async (publicClient: PublicClient): Promise<EIP712Domain> => {
    return getAclEIP712Domain(publicClient);
  },

  /**
   * Check if acp's signed domain matches the provided domain
   */
  matchesDomain: (acp: ACP, domain: EIP712Domain): boolean => {
    return (
      acp._signedDomain?.name === domain.name &&
      acp._signedDomain?.version === domain.version &&
      acp._signedDomain?.verifyingContract === domain.verifyingContract &&
      acp._signedDomain?.chainId === domain.chainId
    );
  },

  /**
   * Check if acp's signed domain is valid for the current chain
   */
  checkSignedDomainValid: async (acp: ACP, publicClient: PublicClient): Promise<boolean> => {
    if (acp._signedDomain == null) return false;
    const domain = await getAclEIP712Domain(publicClient);
    return ACPUtils.matchesDomain(acp, domain);
  },

  /**
   * Check if acp passes the on-chain validation
   */
  checkValidityOnChain: async (acp: ACP, publicClient: PublicClient): Promise<boolean> => {
    const publicAcp = ACPUtils.getPublic(acp);
    return checkACPValidityOnChain(publicAcp, publicClient);
  },
};
