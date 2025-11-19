// Core types
export type {
  Permit,
  CreateSelfPermitOptions as SelfPermitOptions,
  CreateSharingPermitOptions as SharingPermitOptions,
  ImportSharedPermitOptions as ImportPermitOptions,
  SerializedPermit,
  PermitMetadata,
  Permission,
  EIP712Domain,
  EIP712Types,
  EIP712Message,
  ValidationResult,
  PermitSignaturePrimaryType,
} from './types.js';

// Main utilities
export { PermitUtils } from './permit.js';

// Validation utilities
export {
  // Self permit validators
  SelfPermitOptionsValidator,
  SelfPermitValidator,
  validateSelfPermitOptions,
  validateSelfPermit,
  // Sharing permit validators
  SharingPermitOptionsValidator,
  SharingPermitValidator,
  validateSharingPermitOptions,
  validateSharingPermit,
  // Import permit validators
  ImportPermitOptionsValidator,
  ImportPermitValidator,
  validateImportPermitOptions,
  validateImportPermit,
  // Common utilities
  ValidationUtils,
} from './validation.js';

// Signature utilities
export { SignatureUtils, getSignatureTypesAndMessage, SignatureTypes } from './signature.js';

// Storage utilities
export {
  permitStore,
  getPermit,
  getActivePermit,
  getPermits,
  setPermit,
  removePermit,
  getActivePermitHash,
  setActivePermitHash,
  removeActivePermitHash,
  clearStaleStore,
  PERMIT_STORE_DEFAULTS,
} from './store.js';

// Sealing utilities
export { SealingKey, GenerateSealingKey } from './sealing.js';
export type { EthEncryptedData } from './sealing.js';

// Re-export everything for convenience
export * from './types.js';
export * from './permit.js';
export * from './validation.js';
export * from './signature.js';
export * from './store.js';
