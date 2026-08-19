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
  EIP712Domain,
  EIP712Types,
  EIP712Message,
  ValidationResult,
  ACPSignaturePrimaryType,
} from './types.js';

// Main utilities
export { ACPUtils } from './acp.js';

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
} from './validation.js';

// Signature utilities
export { SignatureUtils, getSignatureTypesAndMessage, SignatureTypes } from './signature.js';

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
} from './store.js';

// Sealing utilities
export { GenerateSealingKey, seal, unsealWithPrivateKey, type SealingKeyPair } from './sealing.js';
export type { EthEncryptedData } from './sealing.js';

// Re-export everything for convenience
export * from './types.js';
export * from './acp.js';
export * from './validation.js';
export * from './signature.js';
export * from './store.js';
