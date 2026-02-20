import { SealingKey as SealingKeyClass, type EthEncryptedData } from './sealing.js';
import { type Hex } from 'viem';

/**
 * EIP712 related types
 */
export type EIP712Type = { name: string; type: string };
export type EIP712Types = Record<string, EIP712Type[]>;
export type EIP712Message = Record<string, string>;
export type EIP712Domain = {
  chainId: number;
  name: string;
  verifyingContract: Hex;
  version: string;
};

/**
 * Sealing key type - using the actual SealingKey class
 */
export type SealingKey = SealingKeyClass;

/**
 * Re-export EthEncryptedData from sealing module
 */
export type { EthEncryptedData };

// Viem client types will be imported from viem package

/**
 * Core Permit interface - immutable design for React compatibility
 */
export interface Permit {
  /**
   * Stable hash of relevant permit data, used as key in storage
   */
  hash: string;
  /**
   * Name for this permit, for organization and UI usage, not included in signature.
   */
  name: string;
  /**
   * The type of the Permit (self / sharing)
   * (self) Permit that will be signed and used by the issuer
   * (sharing) Permit that is signed by the issuer, but intended to be shared with recipient
   * (recipient) Permit that has been received, and signed by the recipient
   */
  type: 'self' | 'sharing' | 'recipient';
  /**
   * (base) User that initially created the permission, target of data fetching
   */
  issuer: Hex;
  /**
   * (base) Expiration timestamp
   */
  expiration: number;
  /**
   * (sharing) The user that this permission will be shared with
   * ** optional, use `address(0)` to disable **
   */
  recipient: Hex;
  /**
   * (issuer defined validation) An id used to query a contract to check this permissions validity
   * ** optional, use `0` to disable **
   */
  validatorId: number;
  /**
   * (issuer defined validation) The contract to query to determine permission validity
   * ** optional, user `address(0)` to disable **
   */
  validatorContract: Hex;
  /**
   * (base) The publicKey of a sealingPair used to re-encrypt `issuer`s confidential data
   *   (non-sharing) Populated by `issuer`
   *   (sharing)     Populated by `recipient`
   */
  sealingPair: SealingKey;
  /**
   * (base) `signTypedData` signature created by `issuer`.
   * (base) Shared- and Self- permissions differ in signature format: (`sealingKey` absent in shared signature)
   *   (non-sharing) < issuer, expiration, recipient, validatorId, validatorContract, sealingKey >
   *   (sharing)     < issuer, expiration, recipient, validatorId, validatorContract >
   */
  issuerSignature: Hex;
  /**
   * (sharing) `signTypedData` signature created by `recipient` with format:
   * (sharing) < sealingKey, issuerSignature>
   * ** required for shared permits **
   */
  recipientSignature: Hex;
  /**
   * EIP712 domain used to sign this permit.
   * Should not be set manually, included in metadata as part of serialization flows.
   */
  _signedDomain?: EIP712Domain;
}

/**
 * Permit discriminant helpers
 */
export type PermitType = Permit['type'];

/**
 * Utility type to narrow a permit to a specific discriminant.
 *
 * Note: this only narrows the `type` field. Runtime/validation constraints
 * (e.g. recipient == zeroAddress for self permits) are enforced elsewhere.
 */
export type PermitOf<T extends PermitType> = Expand<Omit<Permit, 'type'> & { type: T }>;

export type SelfPermit = PermitOf<'self'>;
export type SharingPermit = PermitOf<'sharing'>;
export type RecipientPermit = PermitOf<'recipient'>;

/**
 * Optional additional metadata of a Permit
 * Can be passed into the constructor, but not necessary
 * Useful for deserialization
 */
export interface PermitMetadata {
  /**
   * EIP712 domain used to sign this permit.
   * Should not be set manually, included in metadata as part of serialization flows.
   */
  _signedDomain?: EIP712Domain;
}

/**
 * Utility types for permit creation
 */

// Specific option types for each permit creation method
export type CreateSelfPermitOptions = {
  type?: 'self';
  issuer: string;
  name?: string;
  expiration?: number;
  validatorId?: number;
  validatorContract?: string;
};

export type CreateSharingPermitOptions = {
  type?: 'sharing';
  issuer: string;
  recipient: string;
  name?: string;
  expiration?: number;
  validatorId?: number;
  validatorContract?: string;
};

export type ImportSharedPermitOptions = {
  type?: 'sharing';
  issuer: string;
  recipient: string;
  issuerSignature: string;
  name?: string;
  expiration: number;
  validatorId?: number;
  validatorContract?: string;
};

export type SerializedPermit = Omit<Permit, 'sealingPair'> & {
  _signedDomain?: EIP712Domain;
  sealingPair: {
    privateKey: string;
    publicKey: string;
  };
};

/**
 * A type representing the Permission struct that is passed to Permissioned.sol to grant encrypted data access.
 */
export type Permission = Expand<
  Omit<Permit, 'name' | 'type' | 'sealingPair' | 'hash'> & {
    sealingKey: Hex;
  }
>;

/**
 * A type representing the permit fields that are used to generate the hash
 */
export type PermitHashFields = Pick<
  Permit,
  'type' | 'issuer' | 'expiration' | 'recipient' | 'validatorId' | 'validatorContract'
>;

/**
 * Validation result type
 */
export interface ValidationResult {
  valid: boolean;
  error: string | null;
}

/**
 * Signature types for EIP712 signing
 */
export type PermitSignaturePrimaryType =
  | 'PermissionedV2IssuerSelf'
  | 'PermissionedV2IssuerShared'
  | 'PermissionedV2Recipient';

// Utils
export type Expand<T> = T extends infer O ? { [K in keyof O]: O[K] } : never;
