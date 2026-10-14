// Core types
export type {
  ACP,
  CreateSelfACPOptions as SelfACPOptions,
  CreateSharingACPOptions as SharingACPOptions,
  ImportSharedACPOptions as ImportACPOptions,
  SerializedACP,
  ACPMetadata,
  ACPPublic,
  SharedACP,
  IncomingShare,
  LabelledShare,
  EIP712Domain,
  EIP712Types,
  EIP712Message,
  ValidationResult,
  ACPSignaturePrimaryType,
} from './types';

// Main utilities
export { ACPUtils } from './acp';

// On-chain sharing: registry / revoker ABIs, the registry payload and share id of a sharing ACP,
// and the read of posted shares from their Shared events
export * from './registry';

// Share metadata: labels saying where each handle of a SNAPSHOT share came from
export * from './share-metadata/index';

// Addresses the chain ACL serves (TaskManager -> acl() -> default revoker, share registry)
export {
  getAclAddress,
  getAclServedAddresses,
  clearAclServedAddresses,
  type AclServedAddresses,
} from './onchain-utils';

// Validation utilities
export {
  // Self ACP validators
  SelfACPOptionsValidator,
  SelfACPValidator,
  validateSelfACPOptions,
  validateSelfACP,
  // Sharing ACP validators
  SharingACPOptionsValidator,
  SharingACPValidator,
  validateSharingACPOptions,
  validateSharingACP,
  // Import ACP validators
  ImportACPOptionsValidator,
  ImportACPValidator,
  validateImportACPOptions,
  validateImportACP,
  // Common utilities
  ValidationUtils,
} from './validation';

// Signature utilities
export { SignatureUtils, getSignatureTypesAndMessage, SignatureTypes } from './signature';

// Storage utilities
export {
  acpStore,
  getACP,
  getActiveACP,
  getACPs,
  setACP,
  removeACP,
  getActiveACPHash,
  setActiveACPHash,
  removeActiveACPHash,
  clearStaleStore,
  ACP_STORE_DEFAULTS,
} from './store';

// Sealing utilities
export { GenerateSealingKey, seal, unsealWithPrivateKey, type SealingKeyPair } from './sealing';
export type { EthEncryptedData } from './sealing';

// Re-export everything for convenience
export * from './types';
export * from './acp';
export * from './validation';
export * from './signature';
export * from './store';
