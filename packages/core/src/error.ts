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
  EncryptRemainingInItems = 'ENCRYPT_REMAINING_IN_ITEMS',
  ZkUninitialized = 'ZK_UNINITIALIZED',
  ZkVerifierUrlUninitialized = 'ZK_VERIFIER_URL_UNINITIALIZED',
  ThresholdNetworkUrlUninitialized = 'THRESHOLD_NETWORK_URL_UNINITIALIZED',
  SenderUninitialized = 'SENDER_UNINITIALIZED',
  MissingConfig = 'MISSING_CONFIG',
  UnsupportedChain = 'UNSUPPORTED_CHAIN',
  MissingZkBuilderAndCrsGenerator = 'MISSING_ZK_BUILDER_AND_CRS_GENERATOR',
  MissingTfhePublicKeySerializer = 'MISSING_TFHE_PUBLIC_KEY_SERIALIZER',
  MissingCompactPkeCrsSerializer = 'MISSING_COMPACT_PKE_CRS_SERIALIZER',
  MissingFheKey = 'MISSING_FHE_KEY',
  MissingCrs = 'MISSING_CRS',
  FetchKeysFailed = 'FETCH_KEYS_FAILED',
  PublicWalletGetChainIdFailed = 'PUBLIC_WALLET_GET_CHAIN_ID_FAILED',
  PublicWalletGetAddressesFailed = 'PUBLIC_WALLET_GET_ADDRESSES_FAILED',
}

export class CofhesdkError extends Error {
  public readonly code: CofhesdkErrorCode;
  public readonly cause?: Error;
  public readonly hint?: string;
  public readonly context?: Record<string, unknown>;

  constructor({
    code,
    message,
    cause,
    hint,
    context,
  }: {
    code: CofhesdkErrorCode;
    message: string;
    cause?: Error;
    hint?: string;
    context?: Record<string, unknown>;
  }) {
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
   * Serializes the error to JSON string with proper handling of Error objects
   */
  serialize(): string {
    return JSON.stringify({
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
      parts.push(`Context: ${JSON.stringify(this.context, null, 2)}`);
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

export const isCofhesdkError = (error: unknown): error is CofhesdkError =>
  error instanceof CofhesdkError;

export const InternalCofhesdkError = (internalError: unknown): CofhesdkError => {
  if (isCofhesdkError(internalError)) return internalError;

  const error = internalError instanceof Error ? internalError : undefined;

  return new CofhesdkError({
    code: CofhesdkErrorCode.InternalError,
    message: 'An internal error occurred',
    cause: error,
  });
};
