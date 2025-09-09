/* eslint-disable @typescript-eslint/no-unused-vars */
import { keccak256, toHex, zeroAddress } from "viem";
import { parseAbi, type PublicClient, type WalletClient } from "viem";
import {
  Permit,
  PermitOptions,
  SerializedPermit,
  EIP712Domain,
  Permission,
  EthEncryptedData,
} from "./types";
import {
  validatePermitOptions,
  validatePermit,
  ValidationUtils,
} from "./validation";
import { SignatureUtils } from "./signature";
import { GenerateSealingKey, SealingKey } from "./sealing";

/**
 * Main Permit utilities - functional approach for React compatibility
 */
export const PermitUtils = {
  /**
   * Create a new permit from options
   */
  create: async (options: PermitOptions): Promise<Permit> => {
    const validation = validatePermitOptions(options);

    if (!validation.success) {
      throw new Error(
        "PermitUtils :: create :: Parsing PermitOptions failed " +
          JSON.stringify(validation.error, null, 2),
      );
    }

    const parsed = validation.data!;
    // Always generate a new sealing key - users cannot provide their own
    const sealingPair = await GenerateSealingKey();

    // The validation function applies defaults, so we can safely cast to the full Permit type
    const validatedData = parsed as {
      name: string;
      type: "self" | "sharing" | "recipient";
      issuer: string;
      expiration: number;
      recipient: string;
      validatorId: number;
      validatorContract: string;
      issuerSignature: string;
      recipientSignature: string;
    };

    return {
      name: validatedData.name,
      type: validatedData.type,
      issuer: validatedData.issuer,
      expiration: validatedData.expiration,
      recipient: validatedData.recipient,
      validatorId: validatedData.validatorId,
      validatorContract: validatedData.validatorContract,
      sealingPair,
      issuerSignature: validatedData.issuerSignature,
      recipientSignature: validatedData.recipientSignature,
      _signedDomain: undefined,
    };
  },

  /**
   * Create and sign a permit in one operation
   */
  createAndSign: async (
    options: PermitOptions,
    walletClient: WalletClient,
    publicClient: PublicClient,
  ): Promise<Permit> => {
    const permit = await PermitUtils.create(options);
    return PermitUtils.sign(permit, walletClient, publicClient);
  },

  /**
   * Sign a permit with the provided wallet client
   */
  sign: async (
    permit: Permit,
    walletClient: WalletClient,
    publicClient: PublicClient,
  ): Promise<Permit> => {
    if (walletClient == null || walletClient.account == null) {
      throw new Error(
        "PermitUtils :: sign - walletClient undefined, you must pass in a `walletClient` for the connected user to create a permit signature",
      );
    }

    const primaryType = SignatureUtils.getPrimaryType(permit.type);
    const domain = await PermitUtils.fetchEIP712Domain(publicClient);
    const { types, message } = SignatureUtils.getSignatureParams(
      PermitUtils.getPermission(permit, true),
      primaryType,
    );

    const signature = await walletClient.signTypedData({
      domain,
      types,
      primaryType,
      message,
      account: walletClient.account,
    });

    let updatedPermit: Permit;
    if (permit.type === "self" || permit.type === "sharing") {
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
   * Deserialize a permit from serialized data
   */
  deserialize: (data: SerializedPermit): Permit => {
    return {
      ...data,
      sealingPair: SealingKey.deserialize(
        data.sealingPair.privateKey,
        data.sealingPair.publicKey,
      ),
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
    return validatePermit(permit);
  },

  /**
   * Get the permission object from a permit (for use in contracts)
   */
  getPermission: (permit: Permit, skipValidation = false): Permission => {
    if (!skipValidation) {
      const validationResult = validatePermit(permit);
      if (!validationResult.success) {
        throw new Error(
          `PermitUtils :: getPermission :: permit validation failed - ${JSON.stringify(
            validationResult.error,
            null,
            2,
          )} ${JSON.stringify(permit, null, 2)}`,
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

    if (permit.recipient !== zeroAddress)
      cleanedPermit.recipient = permit.recipient;
    if (permit.validatorId !== 0)
      cleanedPermit.validatorId = permit.validatorId;
    if (permit.validatorContract !== zeroAddress)
      cleanedPermit.validatorContract = permit.validatorContract;
    if (permit.type === "sharing" && permit.issuerSignature !== "0x")
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
  fetchEIP712Domain: async (
    publicClient: PublicClient,
  ): Promise<EIP712Domain> => {
    // Hardcoded constants from the original implementation
    const TASK_MANAGER_ADDRESS = "0xeA30c4B8b44078Bbf8a6ef5b9f1eC1626C7848D9";
    const ACL_IFACE = "function acl() view returns (address)";
    const EIP712_DOMAIN_IFACE =
      "function eip712Domain() public view returns (bytes1 fields, string name, string version, uint256 chainId, address verifyingContract, bytes32 salt, uint256[] extensions)";

    // Parse the ABI for the ACL function
    const aclAbi = parseAbi([ACL_IFACE]);

    // Get the ACL address
    const aclAddress = (await publicClient.readContract({
      address: TASK_MANAGER_ADDRESS as `0x${string}`,
      abi: aclAbi,
      functionName: "acl",
    })) as `0x${string}`;

    // Parse the ABI for the EIP712 domain function
    const domainAbi = parseAbi([EIP712_DOMAIN_IFACE]);

    // Get the EIP712 domain
    const domain = await publicClient.readContract({
      address: aclAddress,
      abi: domainAbi,
      functionName: "eip712Domain",
    });

    const [
      _fields,
      name,
      version,
      chainId,
      verifyingContract,
      _salt,
      _extensions,
    ] = domain;

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
  checkSignedDomainValid: async (
    permit: Permit,
    publicClient: PublicClient,
  ): Promise<boolean> => {
    if (permit._signedDomain == null) return false;
    const domain = await PermitUtils.fetchEIP712Domain(publicClient);
    return PermitUtils.matchesDomain(permit, domain);
  },
};
