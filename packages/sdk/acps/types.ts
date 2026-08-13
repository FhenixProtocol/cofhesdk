import { type EthEncryptedData } from './sealing.js';
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
 * Re-export EthEncryptedData from sealing module
 */
export type { EthEncryptedData };

// Viem client types will be imported from viem package

/**
 * The client-side-only component of an ACP — never leaves the client.
 */
export interface ACPPrivate {
  /**
   * Stable hash of relevant acp data, used as key in storage
   */
  hash: string;
  /**
   * Name for this acp, for organization and UI usage, not included in signature.
   */
  name: string;
  /**
   * The type of the ACP (self / sharing / recipient)
   * (self) ACP that will be signed and used by the issuer
   * (sharing) ACP that is signed by the issuer, but intended to be shared with recipient
   * (recipient) ACP that has been received, and signed by the recipient
   */
  type: 'self' | 'sharing' | 'recipient';
  /**
   * The private half of the sealing keypair — used to unseal returned data.
   * `sealingKey` (in the public component) is the corresponding public key.
   * Never leaves the client.
   */
  sealingPrivateKey: Hex;
  /**
   * EIP712 domain used to sign this acp.
   * Should not be set manually, included in metadata as part of serialization flows.
   */
  _signedDomain?: EIP712Domain;
}

/**
 * The public component of an ACP — the signed struct passed on-chain / to the
 * decryption backend to grant encrypted data access. Produced by `getPublic()`.
 */
export interface ACPPublic {
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
   * (revocation) Opaque data interpreted by `revokerContract` — the default
   * revoker interprets it as the acp's creation timestamp.
   * ** optional, use `0` to disable **
   */
  revokerData: number;
  /**
   * (revocation) The contract to query to determine permission validity
   * ** optional, use `address(0)` to disable **
   */
  revokerContract: Hex;
  /**
   * (scope) Scope discriminator — exactly one scope mode per ACP (see ACPScope).
   * Global: all of `issuer`s values (arrays empty). Contract: values readable by
   * `contracts`. Handles: the listed `handles` only.
   */
  scope: number;
  /**
   * (scope) Grants access to `issuer`s values readable by any of these contracts.
   * Checked on-chain as an intersection with the ACL's persisted allowances.
   */
  contracts: Hex[];
  /**
   * (scope) Grants access to these specific ciphertext handles (bytes32 hex)
   */
  handles: Hex[];
  /**
   * (base) The public half of the sealing keypair — used to re-encrypt `issuer`s confidential data
   *   (non-sharing) Populated by `issuer`
   *   (sharing)     Populated by `recipient`
   */
  sealingKey: Hex;
  /**
   * (base) `signTypedData` signature created by `issuer`.
   * (base) Shared- and Self- permissions differ in signature format: (`sealingKey` absent in shared signature)
   */
  issuerSignature: Hex;
  /**
   * (sharing) `signTypedData` signature created by `recipient`
   * ** required for shared acps **
   */
  recipientSignature: Hex;
}

/**
 * Core ACP (Access Control Permission) type — immutable design for React compatibility.
 * The union of the private (client-only) and public (signed) components.
 */
export type ACP = Expand<ACPPrivate & ACPPublic>;

/**
 * ACP discriminant helpers
 */
export type ACPType = ACP['type'];

/**
 * Utility type to narrow a acp to a specific discriminant.
 *
 * Note: this only narrows the `type` field. Runtime/validation constraints
 * (e.g. recipient == zeroAddress for self acps) are enforced elsewhere.
 */
export type ACPOf<T extends ACPType> = Expand<Omit<ACP, 'type'> & { type: T }>;

export type SelfACP = ACPOf<'self'>;
export type SharingACP = ACPOf<'sharing'>;
export type RecipientACP = ACPOf<'recipient'>;

/**
 * Optional additional metadata of a ACP
 * Can be passed into the constructor, but not necessary
 * Useful for deserialization
 */
export interface ACPMetadata {
  /**
   * EIP712 domain used to sign this acp.
   * Should not be set manually, included in metadata as part of serialization flows.
   */
  _signedDomain?: EIP712Domain;
}

/**
 * Utility types for acp creation
 */

/**
 * Scope fields shared by all acp creation options.
 * When any scope array is populated and `global` is not explicitly set,
 * `global` defaults to false (narrowest matching scope); with no scope
 * arrays it defaults to true (V2 behavior).
 */
export const ACPScope = {
  Global: 0,
  Contract: 1,
  Handles: 2,
} as const;

export type ACPScopeOptions = {
  scope?: number;
  contracts?: Hex[];
  handles?: Hex[];
};

// Specific option types for each acp creation method
export type CreateSelfACPOptions = ACPScopeOptions & {
  type?: 'self';
  issuer: string;
  name?: string;
  expiration?: number;
  revokerData?: number;
  revokerContract?: string;
};

export type CreateSharingACPOptions = ACPScopeOptions & {
  type?: 'sharing';
  issuer: string;
  recipient: string;
  name?: string;
  expiration?: number;
  revokerData?: number;
  revokerContract?: string;
};

export type ImportSharedACPOptions = ACPScopeOptions & {
  type?: 'sharing';
  issuer: string;
  recipient: string;
  issuerSignature: string;
  name?: string;
  expiration: number;
  revokerData?: number;
  revokerContract?: string;
};

/** An ACP is plain JSON-serializable data — the serialized form is the ACP itself. */
export type SerializedACP = ACP;

/**
 * The share payload produced by `ACPUtils.export()` — the full public component
 * with `sealingKey`/`recipientSignature` left for the recipient to fill, plus
 * the display name and acp type. Fixed shape: every field is always present
 * (zero-values instead of omissions), so importers can parse a single schema.
 * Mirrors the on-chain sharing payload struct field-for-field.
 */
export type SharedACP = Expand<
  Omit<ACPPublic, 'sealingKey' | 'recipientSignature'> & {
    name: string;
    type: 'sharing';
  }
>;

/**
 * A share read back from the on-chain ACPShareRegistry: the posted payload
 * (SharedACP minus the client-side name/type) plus its registry id.
 */
export type IncomingShare = Expand<Omit<SharedACP, 'name' | 'type'> & { shareId: Hex }>;

/**
 * A type representing the acp fields that are used to generate the hash
 */
export type ACPHashFields = Pick<
  ACP,
  'type' | 'issuer' | 'expiration' | 'recipient' | 'revokerData' | 'revokerContract' | 'scope' | 'contracts' | 'handles'
>;

/**
 * Validation result type
 */
export interface ValidationResult {
  valid: boolean;
  error: 'invalid-schema' | 'expired' | 'not-signed' | null;
}

/**
 * Signature types for EIP712 signing
 */
export type ACPSignaturePrimaryType = 'ACPIssuerSelf' | 'ACPIssuerShared' | 'ACPRecipient';

// Utils
export type Expand<T> = T extends infer O ? { [K in keyof O]: O[K] } : never;
