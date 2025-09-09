// Core types
export type {
  Permit,
  PermitOptions,
  SerializedPermit,
  PermitMetadata,
  Permission,
  EIP712Domain,
  EIP712Types,
  EIP712Message,
  ValidationResult,
  PermitSignaturePrimaryType,
} from "./types";

// Main utilities
export { PermitUtils } from "./permit";

// Validation utilities
export {
  validatePermitOptions,
  validatePermit,
  ValidationUtils,
  PermitParamsValidator,
  FullyFormedPermitValidator,
} from "./validation";

// Signature utilities
export {
  SignatureUtils,
  getSignatureTypesAndMessage,
  SignatureTypes,
} from "./signature";

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
} from "./storage";

// Sealing utilities
export { SealingKey, GenerateSealingKey } from "./sealing";
export type { EthEncryptedData } from "./sealing";

// Re-export everything for convenience
export * from "./types";
export * from "./permit";
export * from "./validation";
export * from "./signature";
export * from "./storage";
