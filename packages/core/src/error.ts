/* eslint-disable no-unused-vars */

export enum CofhesdkErrorCode {
  InternalError = 'INTERNAL_ERROR',
  UnknownEnvironment = 'UNKNOWN_ENVIRONMENT',
  InitTfheFailed = 'INIT_TFHE_FAILED',
  InitViemFailed = 'INIT_VIEM_FAILED',
  InitEthersFailed = 'INIT_ETHERS_FAILED',
  NotInitialized = 'NOT_INITIALIZED',
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
  FheKeyNotFound = 'FHE_KEY_NOT_FOUND',
  CrsNotFound = 'CRS_NOT_FOUND',
  ProviderNotInitialized = 'PROVIDER_NOT_INITIALIZED',
  SignerNotInitialized = 'SIGNER_NOT_INITIALIZED',
  SealOutputFailed = 'SEAL_OUTPUT_FAILED',
  SealOutputReturnedNull = 'SEAL_OUTPUT_RETURNED_NULL',
  InvalidUtype = 'INVALID_UTYPE',
  DecryptFailed = 'DECRYPT_FAILED',
  DecryptReturnedNull = 'DECRYPT_RETURNED_NULL',
  ZkVerifyInsertPackedCtHashesFailed = 'ZK_VERIFY_INSERT_PACKED_CT_HASHES_FAILED',
  ZkVerifySignFailed = 'ZK_VERIFY_SIGN_FAILED',
  ZkVerifyFailed = 'ZK_VERIFY_FAILED',
  EncryptRemainingInItems = 'ENCRYPT_REMAINING_IN_ITEMS',
  ZkUninitialized = 'ZK_UNINITIALIZED',
  ZkVerifierUrlUninitialized = 'ZK_VERIFIER_URL_UNINITIALIZED',
}

export class CofhesdkError extends Error {
  public readonly code: CofhesdkErrorCode;
  public readonly cause?: Error;

  constructor({ code, message, cause }: { code: CofhesdkErrorCode; message: string; cause?: Error }) {
    super(message);
    this.name = 'CofhesdkError';
    this.code = code;
    this.cause = cause;

    // Maintains proper stack trace for where our error was thrown (only available on V8)
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, CofhesdkError);
    }
  }

  serialize(): string {
    return JSON.stringify({
      code: this.code,
      message: this.message,
      cause: this.cause,
    });
  }
}

export const isCofhesdkError = (error: unknown): error is CofhesdkError => {
  if (error instanceof CofhesdkError) return true;
  return false;
};

export const InternalCofhesdkError = (internalError: unknown): CofhesdkError => {
  if (isCofhesdkError(internalError)) return internalError;
  const error = internalError instanceof Error ? internalError : undefined;
  return new CofhesdkError({
    code: CofhesdkErrorCode.InternalError,
    message: `An internal error occurred: ${error?.message ?? 'Unknown error'}`,
    cause: error,
  });
};
