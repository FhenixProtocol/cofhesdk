// Client (base implementations)
export { createCofhesdkClientBase } from './client.js';

// Configuration (base implementations)
export { createCofhesdkConfigBase, getCofhesdkConfigItem } from './config.js';
export type { CofhesdkConfig, CofhesdkInputConfig, CofhesdkInternalConfig } from './config.js';

// Types
export type {
  // Client types
  CofhesdkClient,
  CofhesdkClientParams,
  CofhesdkClientConnectionState,
  CofhesdkClientPermits,
  IStorage,
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
  EncryptStepCallbackFunction as EncryptSetStateFn,
} from './types.js';
export { FheTypes, FheUintUTypes, FheAllUTypes, Encryptable, isEncryptableItem, EncryptStep } from './types.js';

// Error handling
export { CofhesdkError, CofhesdkErrorCode, isCofhesdkError } from './error.js';
export type { CofhesdkErrorParams } from './error.js';

// Result types
export {
  ResultErr,
  ResultOk,
  ResultErrOrInternal,
  ResultHttpError,
  ResultValidationError,
  resultWrapper,
  resultWrapperSync,
} from './result.js';
export type { Result } from './result.js';

// Key fetching
export { fetchKeys, fetchMultichainKeys } from './fetchKeys.js';
export type { FheKeyDeserializer } from './fetchKeys.js';

// Key storage
export { createKeysStore } from './keyStore.js';
export type { KeysStorage, KeysStore } from './keyStore.js';

// Builders (exported via client, but can be imported directly for typing)
export { EncryptInputsBuilder } from './encrypt/encryptInputsBuilder.js';
export { DecryptHandlesBuilder } from './decrypt/decryptHandleBuilder.js';

// ZK utilities
export type { ZkBuilderAndCrsGenerator } from './encrypt/zkPackProveVerify.js';
