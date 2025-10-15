/* eslint-disable no-unused-vars */

export enum CofhesdkErrorCode {
  InternalError = 'INTERNAL_ERROR',
  UnknownEnvironment = 'UNKNOWN_ENVIRONMENT',
  InitTfheFailed = 'INIT_TFHE_FAILED',
  InitViemFailed = 'INIT_VIEM_FAILED',
  InitEthersFailed = 'INIT_ETHERS_FAILED',
  NotConnected = 'NOT_CONNECTED',
  MissingPublicClient = 'MISSING_PUBLIC_CLIENT',
  MissingWalletClient = 'MISSING_WALLET_CLIENT',
  MissingProviderParam = 'MISSING_PROVIDER_PARAM',
  EmptySecurityZonesParam = 'EMPTY_SECURITY_ZONES_PARAM',
  InvalidPermitData = 'INVALID_PERMIT_DATA',
  InvalidPermitDomain = 'INVALID_PERMIT_DOMAIN',
  PermitNotFound = 'PERMIT_NOT_FOUND',
  CannotRemoveLastPermit = 'CANNOT_REMOVE_LAST_PERMIT',
  AccountUninitialized = 'ACCOUNT_UNINITIALIZED',
  ChainIdUninitialized = 'CHAIN_ID_UNINITIALIZED',
  SealOutputFailed = 'SEAL_OUTPUT_FAILED',
  SealOutputReturnedNull = 'SEAL_OUTPUT_RETURNED_NULL',
  InvalidUtype = 'INVALID_UTYPE',
  DecryptFailed = 'DECRYPT_FAILED',
  DecryptReturnedNull = 'DECRYPT_RETURNED_NULL',
  ZkMocksInsertCtHashesFailed = 'ZK_MOCKS_INSERT_CT_HASHES_FAILED',
  ZkMocksCalcCtHashesFailed = 'ZK_MOCKS_CALC_CT_HASHES_FAILED',
  ZkMocksVerifySignFailed = 'ZK_MOCKS_VERIFY_SIGN_FAILED',
  ZkMocksCreateProofSignatureFailed = 'ZK_MOCKS_CREATE_PROOF_SIGNATURE_FAILED',
  ZkVerifyFailed = 'ZK_VERIFY_FAILED',
  ZkPackFailed = 'ZK_PACK_FAILED',
  ZkProveFailed = 'ZK_PROVE_FAILED',
  EncryptRemainingInItems = 'ENCRYPT_REMAINING_IN_ITEMS',
  ZkUninitialized = 'ZK_UNINITIALIZED',
  ZkVerifierUrlUninitialized = 'ZK_VERIFIER_URL_UNINITIALIZED',
  ThresholdNetworkUrlUninitialized = 'THRESHOLD_NETWORK_URL_UNINITIALIZED',
  MissingConfig = 'MISSING_CONFIG',
  UnsupportedChain = 'UNSUPPORTED_CHAIN',
  MissingZkBuilderAndCrsGenerator = 'MISSING_ZK_BUILDER_AND_CRS_GENERATOR',
  MissingTfhePublicKeyDeserializer = 'MISSING_TFHE_PUBLIC_KEY_DESERIALIZER',
  MissingCompactPkeCrsDeserializer = 'MISSING_COMPACT_PKE_CRS_DESERIALIZER',
  MissingFheKey = 'MISSING_FHE_KEY',
  MissingCrs = 'MISSING_CRS',
  FetchKeysFailed = 'FETCH_KEYS_FAILED',
  PublicWalletGetChainIdFailed = 'PUBLIC_WALLET_GET_CHAIN_ID_FAILED',
  PublicWalletGetAddressesFailed = 'PUBLIC_WALLET_GET_ADDRESSES_FAILED',
  RehydrateKeysStoreFailed = 'REHYDRATE_KEYS_STORE_FAILED',
}

export type CofhesdkErrorParams = {
  code: CofhesdkErrorCode;
  message: string;
  cause?: Error;
  hint?: string;
  context?: Record<string, unknown>;
};

/**
 * CofhesdkError class
 * This class is used to create errors that are specific to the CoFHE SDK
 * It extends the Error class and adds a code, cause, hint, and context
 * The code is used to identify the type of error
 * The cause is used to indicate the inner error that caused the CofhesdkError
 * The hint is used to provide a hint about how to fix the error
 * The context is used to provide additional context about the state that caused the error
 * The serialize method is used to serialize the error to a JSON string
 * The toString method is used to provide a human-readable string representation of the error
 */
export class CofhesdkError extends Error {
  public readonly code: CofhesdkErrorCode;
  public readonly cause?: Error;
  public readonly hint?: string;
  public readonly context?: Record<string, unknown>;

  constructor({ code, message, cause, hint, context }: CofhesdkErrorParams) {
    // If there's a cause, append its message to provide full context
    const fullMessage = cause ? `${message} | Caused by: ${cause.message}` : message;

    super(fullMessage);
    this.name = 'CofhesdkError';
    this.code = code;
    this.cause = cause;
    this.hint = hint;
    this.context = context;

    // Maintains proper stack trace for where our error was thrown (only available on V8)
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, CofhesdkError);
    }
  }

  /**
   * Creates a CofhesdkError from an unknown error
   * If the error is a CofhesdkError, it is returned unchanged, else a new CofhesdkError is created
   * If a wrapperError is provided, it is used to create the new CofhesdkError, else a default is used
   */
  static fromError(error: unknown, wrapperError?: CofhesdkErrorParams): CofhesdkError {
    if (isCofhesdkError(error)) return error;

    const cause = error instanceof Error ? error : new Error(`${error}`);

    return new CofhesdkError({
      code: wrapperError?.code ?? CofhesdkErrorCode.InternalError,
      message: wrapperError?.message ?? 'An internal error occurred',
      hint: wrapperError?.hint,
      context: wrapperError?.context,
      cause: cause,
    });
  }

  /**
   * Serializes the error to JSON string with proper handling of Error objects
   */
  serialize(): string {
    return bigintSafeJsonStringify({
      name: this.name,
      code: this.code,
      message: this.message,
      hint: this.hint,
      context: this.context,
      cause: this.cause
        ? {
            name: this.cause.name,
            message: this.cause.message,
            stack: this.cause.stack,
          }
        : undefined,
      stack: this.stack,
    });
  }

  /**
   * Returns a human-readable string representation of the error
   */
  toString(): string {
    const parts = [`${this.name} [${this.code}]: ${this.message}`];

    if (this.hint) {
      parts.push(`Hint: ${this.hint}`);
    }

    if (this.context && Object.keys(this.context).length > 0) {
      parts.push(`Context: ${bigintSafeJsonStringify(this.context)}`);
    }

    if (this.stack) {
      parts.push(`\nStack trace:`);
      parts.push(this.stack);
    }

    if (this.cause) {
      parts.push(`\nCaused by: ${this.cause.name}: ${this.cause.message}`);
      if (this.cause.stack) {
        parts.push(this.cause.stack);
      }
    }

    return parts.join('\n');
  }
}

const bigintSafeJsonStringify = (value: unknown): string => {
  return JSON.stringify(value, (key, value) => {
    if (typeof value === 'bigint') {
      return `${value}n`;
    }
    return value;
  });
};

export const isCofhesdkError = (error: unknown): error is CofhesdkError => error instanceof CofhesdkError;
