// Client (base implementations)
export { createCofheClientBase, InitialConnectStore as CONNECT_STORE_DEFAULTS } from './client.js';

// Configuration (base implementations)
export { createCofheConfigBase, getCofheConfigItem } from './config.js';
export type { CofheConfig, CofheInputConfig, CofheInternalConfig } from './config.js';

// Types
export type {
  // Client types
  CofheClient as CofheClient,
  CofheClientParams as CofheClientParams,
  CofheClientConnectionState as CofheClientConnectionState,
  CofheClientPermits as CofheClientPermits,
} from './clientTypes.js';

export type {
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
  EncryptedAddressInput,
  EncryptedItemInputs,
  EncryptableToEncryptedItemInputMap,
  FheTypeValue,
  // Decryption types
  UnsealedItem,
  DecryptPollCallbackFunction,
  DecryptPollCallbackContext,
  DecryptEndpoint,
  // Util types
  EncryptStepCallbackFunction as EncryptSetStateFn,
  EncryptStepCallbackContext,
} from './types.js';
export {
  FheTypes,
  FheUintUTypes,
  FheAllUTypes,
  Encryptable,
  isEncryptableItem,
  EncryptStep,
  isLastEncryptionStep,
  assertCorrectEncryptedItemInput,
} from './types.js';

// Error handling
export { CofheError, CofheErrorCode, isCofheError } from './error.js';
export type { CofheErrorParams } from './error.js';

// Key fetching
export { fetchKeys } from './fetchKeys.js';
export type { FheKeyDeserializer } from './fetchKeys.js';

// Key storage
export { createKeysStore } from './keyStore.js';
export type { KeysStorage, KeysStore } from './keyStore.js';

// Builders (exported via client, but can be imported directly for typing)
export { EncryptInputsBuilder } from './encrypt/encryptInputsBuilder.js';
export { DecryptForViewBuilder } from './decrypt/decryptForViewBuilder.js';
export { DecryptForTxBuilder } from './decrypt/decryptForTxBuilder.js';
export type { DecryptForTxResult } from './decrypt/decryptForTxBuilder.js';

// ZK utilities
export type {
  ZkBuilderAndCrsGenerator,
  ZkProveWorkerFunction,
  ZkProveWorkerRequest,
  ZkProveWorkerResponse,
} from './encrypt/zkPackProveVerify.js';
export { zkProveWithWorker } from './encrypt/zkPackProveVerify.js';

// Consts (contract addresses, serialized size limits)
export {
  TASK_MANAGER_ADDRESS,
  MOCKS_ZK_VERIFIER_ADDRESS,
  MOCKS_ZK_VERIFIER_SIGNER_ADDRESS,
  MOCKS_ZK_VERIFIER_SIGNER_PRIVATE_KEY,
  MOCKS_DECRYPT_RESULT_SIGNER_PRIVATE_KEY,
  MOCKS_THRESHOLD_NETWORK_ADDRESS,
  TEST_BED_ADDRESS,
  TFHE_RS_ZK_MAX_BITS,
  TFHE_RS_SAFE_SERIALIZATION_SIZE_LIMIT,
} from './consts.js';

// Decrypt result verification
export { verifyDecryptResult } from './decrypt/verifyDecryptResult.js';

// Utils
export { fheTypeToString } from './utils.js';
