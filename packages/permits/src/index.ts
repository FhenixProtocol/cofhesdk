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
} from './types';

// Main utilities
export { PermitUtils } from './permit';

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
} from './validation';

// Signature utilities
export { SignatureUtils, getSignatureTypesAndMessage, SignatureTypes } from './signature';

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
} from './store';

// Sealing utilities
export { SealingKey, GenerateSealingKey } from './sealing';
export type { EthEncryptedData } from './sealing';

// Re-export everything for convenience
export * from './types';
export * from './permit';
export * from './validation';
export * from './signature';
export * from './store';
