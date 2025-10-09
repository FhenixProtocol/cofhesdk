// Client
export { createCofhesdkClient } from './client';

// Configuration
export { createCofhesdkConfig, getCofhesdkConfigItem } from './config';
export type { CofhesdkConfig, CofhesdkInputConfig, CofhesdkInternalConfig } from './config';

// Types
export type {
  // Client types
  CofhesdkClient,
  CofhesdkClientParams,
  CofhesdkClientConnectionState,
  CofhesdkClientPermits,
  // Primitive types
  Primitive,
  LiteralToPrimitive,
  // Encryptable types
  EncryptableItem,
  EncryptableBool,
  EncryptableUint8,
  EncryptableUint16,
  EncryptableUint32,
  EncryptableUint64,
  EncryptableUint128,
  EncryptableAddress,
  // Encrypted types
  EncryptedNumber,
  EncryptedItemInput,
  EncryptedBoolInput,
  EncryptedUint8Input,
  EncryptedUint16Input,
  EncryptedUint32Input,
  EncryptedUint64Input,
  EncryptedUint128Input,
  EncryptedUint256Input,
  EncryptedAddressInput,
  EncryptedItemInputs,
  EncryptableToEncryptedItemInputMap,
  // Decryption types
  UnsealedItem,
  // Util types
  EncryptSetStateFn,
} from './types';
export { FheTypes, FheUintUTypes, FheAllUTypes, Encryptable, isEncryptableItem, EncryptStep } from './types';

// Error handling
export { CofhesdkError, CofhesdkErrorCode, isCofhesdkError } from './error';
export type { CofhesdkErrorParams } from './error';

// Result types
export {
  ResultErr,
  ResultOk,
  ResultErrOrInternal,
  ResultHttpError,
  ResultValidationError,
  resultWrapper,
  resultWrapperSync,
} from './result';
export type { Result } from './result';

// Key fetching
export { fetchKeys, fetchMultichainKeys } from './fetchKeys';
export type { FheKeySerializer } from './fetchKeys';

// Builders (exported via client, but can be imported directly for typing)
export { EncryptInputsBuilder } from './encrypt/encryptInputsBuilder';
export { DecryptHandlesBuilder } from './decrypt/decryptHandleBuilder';

// ZK utilities
export type { ZkBuilderAndCrsGenerator } from './encrypt/zkPackProveVerify';
