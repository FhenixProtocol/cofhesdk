import { keccak256, toHex, zeroAddress } from 'viem';
import { parseAbi, type PublicClient, type WalletClient } from 'viem';
import {
  Permit,
  CreateSelfPermitOptions,
  CreateSharingPermitOptions,
  ImportSharedPermitOptions,
  SerializedPermit,
  EIP712Domain,
  Permission,
  EthEncryptedData,
} from './types';
import {
  validateSelfPermitOptions,
  validateSharingPermitOptions,
  validateImportPermitOptions,
  validateSelfPermit,
  validateSharingPermit,
  validateImportPermit,
  ValidationUtils,
} from './validation';
import { SignatureUtils } from './signature';
import { GenerateSealingKey, SealingKey } from './sealing';

/**
 * Main Permit utilities - functional approach for React compatibility
 */
export const PermitUtils = {
  /**
   * Create a self permit for personal use
   */
  createSelf: async (options: CreateSelfPermitOptions): Promise<Permit> => {
    const validation = validateSelfPermitOptions(options);

    if (!validation.success) {
      throw new Error(
        'PermitUtils :: createSelf :: Parsing SelfPermitOptions failed ' + JSON.stringify(validation.error, null, 2)
      );
    }

    // Always generate a new sealing key - users cannot provide their own
    const sealingPair = await GenerateSealingKey();

    return {
      ...validation.data,
      sealingPair,
      _signedDomain: undefined,
    };
  },

  /**
   * Create a sharing permit to be shared with another user
   */
  createSharing: async (options: CreateSharingPermitOptions): Promise<Permit> => {
    const validation = validateSharingPermitOptions(options);

    if (!validation.success) {
      throw new Error(
        'PermitUtils :: createSharing :: Parsing SharingPermitOptions failed ' +
          JSON.stringify(validation.error, null, 2)
      );
    }

    // Always generate a new sealing key - users cannot provide their own
    const sealingPair = await GenerateSealingKey();

    return {
      ...validation.data,
      sealingPair,
      _signedDomain: undefined,
    };
  },

  /**
   * Import a shared permit from various input formats
   */
  importShared: async (options: ImportSharedPermitOptions | any | string): Promise<Permit> => {
    let parsedOptions: ImportSharedPermitOptions;

    // Handle different input types
    if (typeof options === 'string') {
      // Parse JSON string
      try {
        parsedOptions = JSON.parse(options);
      } catch (error) {
        throw new Error(`PermitUtils :: importShared :: Failed to parse JSON string: ${error}`);
      }
    } else if (typeof options === 'object' && options !== null) {
      // Handle both ImportSharedPermitOptions and any object
      parsedOptions = options;
    } else {
      throw new Error(
        'PermitUtils :: importShared :: Invalid input type, expected ImportSharedPermitOptions, object, or string'
      );
    }

    // Validate type if provided
    if (parsedOptions.type != null && parsedOptions.type !== 'sharing') {
      throw new Error(`PermitUtils :: importShared :: Invalid permit type <${parsedOptions.type}>, must be "sharing"`);
    }

    const validation = validateImportPermitOptions({ ...parsedOptions, type: 'recipient' });

    if (!validation.success) {
      throw new Error(
        'PermitUtils :: importShared :: Parsing ImportPermitOptions failed ' + JSON.stringify(validation.error, null, 2)
      );
    }

    // Always generate a new sealing key - users cannot provide their own
    const sealingPair = await GenerateSealingKey();

    return {
      ...validation.data,
      sealingPair,
      _signedDomain: undefined,
    };
  },

  /**
   * Sign a permit with the provided wallet client
   */
  sign: async (permit: Permit, publicClient: PublicClient, walletClient: WalletClient): Promise<Permit> => {
    if (walletClient == null || walletClient.account == null) {
      throw new Error(
        'PermitUtils :: sign - walletClient undefined, you must pass in a `walletClient` for the connected user to create a permit signature'
      );
    }

    const primaryType = SignatureUtils.getPrimaryType(permit.type);
    const domain = await PermitUtils.fetchEIP712Domain(publicClient);
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

    return updatedPermit;
  },

  /**
   * Create and sign a self permit in one operation
   */
  createSelfAndSign: async (
    options: CreateSelfPermitOptions,
    publicClient: PublicClient,
    walletClient: WalletClient
  ): Promise<Permit> => {
    const permit = await PermitUtils.createSelf(options);
    return PermitUtils.sign(permit, publicClient, walletClient);
  },

  /**
   * Create and sign a sharing permit in one operation
   */
  createSharingAndSign: async (
    options: CreateSharingPermitOptions,
    publicClient: PublicClient,
    walletClient: WalletClient
  ): Promise<Permit> => {
    const permit = await PermitUtils.createSharing(options);
    return PermitUtils.sign(permit, publicClient, walletClient);
  },

  /**
   * Import and sign a shared permit in one operation from various input formats
   */
  importSharedAndSign: async (
    options: ImportSharedPermitOptions | any | string,
    publicClient: PublicClient,
    walletClient: WalletClient
  ): Promise<Permit> => {
    const permit = await PermitUtils.importShared(options);
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
      throw new Error('PermitUtils :: validate :: Invalid permit type');
    }
  },

  /**
   * Get the permission object from a permit (for use in contracts)
   */
  getPermission: (permit: Permit, skipValidation = false): Permission => {
    if (!skipValidation) {
      const validationResult = PermitUtils.validate(permit);

      if (!validationResult.success) {
        throw new Error(
          `PermitUtils :: getPermission :: permit validation failed - ${JSON.stringify(validationResult.error, null, 2)} ${JSON.stringify(permit, null, 2)}`
        );
      }
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
  getHash: (permit: Permit): string => {
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
    // Hardcoded constants from the original implementation
    const TASK_MANAGER_ADDRESS = '0xeA30c4B8b44078Bbf8a6ef5b9f1eC1626C7848D9';
    const ACL_IFACE = 'function acl() view returns (address)';
    const EIP712_DOMAIN_IFACE =
      'function eip712Domain() public view returns (bytes1 fields, string name, string version, uint256 chainId, address verifyingContract, bytes32 salt, uint256[] extensions)';

    // Parse the ABI for the ACL function
    const aclAbi = parseAbi([ACL_IFACE]);

    // Get the ACL address
    const aclAddress = (await publicClient.readContract({
      address: TASK_MANAGER_ADDRESS as `0x${string}`,
      abi: aclAbi,
      functionName: 'acl',
    })) as `0x${string}`;

    // Parse the ABI for the EIP712 domain function
    const domainAbi = parseAbi([EIP712_DOMAIN_IFACE]);

    // Get the EIP712 domain
    const domain = await publicClient.readContract({
      address: aclAddress,
      abi: domainAbi,
      functionName: 'eip712Domain',
    });

    // eslint-disable-next-line no-unused-vars
    const [_fields, name, version, chainId, verifyingContract, _salt, _extensions] = domain;

    return {
      name,
      version,
      chainId: Number(chainId),
      verifyingContract,
    };
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
    const domain = await PermitUtils.fetchEIP712Domain(publicClient);
    return PermitUtils.matchesDomain(permit, domain);
  },
};
