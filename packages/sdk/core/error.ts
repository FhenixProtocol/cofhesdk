export enum CofheErrorCode {
  InternalError = 'INTERNAL_ERROR',
  /** The caller passed a value the SDK cannot use. `hint` says what the argument should be. */
  InvalidArgument = 'INVALID_ARGUMENT',
  /** `createCofheConfig` rejected the config. `context.issues` lists each rejected key. */
  InvalidConfig = 'INVALID_CONFIG',
  UnknownEnvironment = 'UNKNOWN_ENVIRONMENT',
  InitTfheFailed = 'INIT_TFHE_FAILED',
  InitViemFailed = 'INIT_VIEM_FAILED',
  InitEthersFailed = 'INIT_ETHERS_FAILED',
  NotConnected = 'NOT_CONNECTED',
  MissingPublicClient = 'MISSING_PUBLIC_CLIENT',
  MissingWalletClient = 'MISSING_WALLET_CLIENT',
  MissingProviderParam = 'MISSING_PROVIDER_PARAM',
  EmptySecurityZonesParam = 'EMPTY_SECURITY_ZONES_PARAM',
  InvalidACPData = 'INVALID_ACP_DATA',
  InvalidACPDomain = 'INVALID_ACP_DOMAIN',
  ACPNotFound = 'ACP_NOT_FOUND',
  CannotRemoveLastACP = 'CANNOT_REMOVE_LAST_ACP',
  AccountUninitialized = 'ACCOUNT_UNINITIALIZED',
  ChainIdUninitialized = 'CHAIN_ID_UNINITIALIZED',
  ChainIdMismatch = 'CHAIN_ID_MISMATCH',
  ConsumingContractUninitialized = 'CONSUMING_CONTRACT_UNINITIALIZED',
  ConsumingContractInvalid = 'CONSUMING_CONTRACT_INVALID',
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
  /** @deprecated No longer thrown: `connect` reads the wallet client's `account` and throws `WalletClientAccountMissing` without one. */
  PublicWalletGetAddressesFailed = 'PUBLIC_WALLET_GET_ADDRESSES_FAILED',
  WalletClientAccountMissing = 'WALLET_CLIENT_ACCOUNT_MISSING',
  RehydrateKeysStoreFailed = 'REHYDRATE_KEYS_STORE_FAILED',
  TaskManagerUnresolved = 'TASK_MANAGER_UNRESOLVED',

  // Threshold-network stable error codes (decrypt/sealoutput), see API-RESPONSES.md
  BadRequest = 'BAD_REQUEST',
  UnknownChain = 'UNKNOWN_CHAIN',
  ACPMalformed = 'ACP_MALFORMED',
  ACPDenied = 'ACP_DENIED',
  ACPExpired = 'ACP_EXPIRED',
  ACPInvalid = 'ACP_INVALID',
  ACPRevoked = 'ACP_REVOKED',
  NotPubliclyAllowed = 'NOT_PUBLICLY_ALLOWED',
  CtNotFound = 'CT_NOT_FOUND',
  UnsupportedSecurityZone = 'UNSUPPORTED_SECURITY_ZONE',
  UnsupportedType = 'UNSUPPORTED_TYPE',
  SigningFailed = 'SIGNING_FAILED',
  CtSourceError = 'CT_SOURCE_ERROR',
  ACPVerifierError = 'ACP_VERIFIER_ERROR',
  CtSourceTimeout = 'CT_SOURCE_TIMEOUT',
  ACPVerifierTimeout = 'ACP_VERIFIER_TIMEOUT',
  ACPRequired = 'ACP_REQUIRED',
  SealFailed = 'SEAL_FAILED',
}

export type CofheErrorParams = {
  code: CofheErrorCode;
  message: string;
  cause?: Error;
  hint?: string;
  context?: Record<string, unknown>;
  /** Raw backend `error` string, when this error originated from a threshold-network response. */
  apiErrorCode?: string;
  /**
   * HTTP status of the failed response, when this error came from one (verifier or threshold network).
   * Unset when no response arrived, e.g. the network was unreachable.
   */
  httpStatus?: number;
};

/**
 * Marks a CofheError. Registered globally, so it is the same symbol in every copy of the SDK
 * loaded in a process (ESM next to CJS, or two installed versions), where `instanceof` fails.
 */
const COFHE_ERROR_BRAND = Symbol.for('@cofhe/sdk/CofheError');

/**
 * Where the repair guide sits in a project that installed the SDK. It ships in the package, so it
 * describes the installed version.
 */
const REPAIR_GUIDE_PATH = 'node_modules/@cofhe/sdk/skills/cofhe-errors/SKILL.md';

/** The section of the repair guide for `code`, as a path with an anchor. */
const repairGuideFor = (code: CofheErrorCode): string => `${REPAIR_GUIDE_PATH}#${code.toLowerCase()}`;

/**
 * An error thrown by the CoFHE SDK.
 *
 * - `code`: what went wrong. Stable; branch on this.
 * - `shortMessage`: one sentence, safe to show to a user.
 * - `message`: `shortMessage`, then the cause, the hint and the repair guide, so that a log or a
 *   test runner that prints only the message still shows how to fix it.
 * - `hint`: how to fix it, addressed to the developer.
 * - `context`: the values involved. Plain data only: never a client, signer or key.
 * - `cause`: the underlying error, when there is one.
 * - `repairGuide`: the section for this code in the guide shipped with the package: causes and
 *   fixes in more depth than the hint.
 *
 * Detect one with `isCofheError(error)` rather than `instanceof`.
 */
export class CofheError extends Error {
  public readonly code: CofheErrorCode;
  /** The message without the cause and the hint. Use it for text shown to a user. */
  public readonly shortMessage: string;
  public readonly cause?: Error;
  public readonly hint?: string;
  public readonly context?: Record<string, unknown>;
  public readonly apiErrorCode?: string;
  public readonly httpStatus?: number;
  /**
   * Path, from the project root, of this code's section in the repair guide shipped with the
   * package: `node_modules/@cofhe/sdk/skills/cofhe-errors/SKILL.md#acp_not_found`.
   */
  public readonly repairGuide: string;
  /** @internal */
  public readonly [COFHE_ERROR_BRAND] = true;

  constructor({ code, message, cause, hint, context, apiErrorCode, httpStatus }: CofheErrorParams) {
    const repairGuide = repairGuideFor(code);
    const fullMessage = [
      message,
      cause && `Caused by: ${cause.message}`,
      hint && `Hint: ${hint}`,
      `Guide: ${repairGuide}`,
    ]
      .filter(Boolean)
      .join(' | ');

    super(fullMessage);
    this.name = 'CofheError';
    this.code = code;
    this.shortMessage = message;
    this.cause = cause;
    this.hint = hint;
    this.context = context;
    this.apiErrorCode = apiErrorCode;
    this.httpStatus = httpStatus;
    this.repairGuide = repairGuide;

    // Maintains proper stack trace for where our error was thrown (only available on V8)
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, CofheError);
    }
  }

  /**
   * Creates a CofheError from an unknown error
   * If the error is a CofheError, it is returned unchanged, else a new CofheError is created
   * If a wrapperError is provided, it is used to create the new CofheError, else a default is used
   */
  static fromError(error: unknown, wrapperError?: CofheErrorParams): CofheError {
    if (isCofheError(error)) return error;

    const cause = error instanceof Error ? error : new Error(`${error}`);

    return new CofheError({
      code: wrapperError?.code ?? CofheErrorCode.InternalError,
      message: wrapperError?.message ?? 'An internal error occurred',
      hint: wrapperError?.hint,
      context: wrapperError?.context,
      apiErrorCode: wrapperError?.apiErrorCode,
      httpStatus: wrapperError?.httpStatus,
      cause: cause,
    });
  }

  /**
   * Serializes the error to JSON string with proper handling of Error objects
   */
  serialize(): string {
    return safeJsonStringify({
      name: this.name,
      code: this.code,
      message: this.message,
      shortMessage: this.shortMessage,
      hint: this.hint,
      repairGuide: this.repairGuide,
      context: this.context,
      apiErrorCode: this.apiErrorCode,
      httpStatus: this.httpStatus,
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
    const apiSuffix = this.apiErrorCode ? ` (api: ${this.apiErrorCode})` : '';
    const httpSuffix = this.httpStatus != null ? ` (http: ${this.httpStatus})` : '';
    const codeSuffix = `${apiSuffix}${httpSuffix}`;
    // The hint and the cause get their own lines below
    const parts = [`${this.name} [${this.code}]${codeSuffix}: ${this.shortMessage}`];

    if (this.hint) {
      parts.push(`Hint: ${this.hint}`);
    }

    parts.push(`Guide: ${this.repairGuide}`);

    if (this.context && Object.keys(this.context).length > 0) {
      parts.push(`Context: ${safeJsonStringify(this.context)}`);
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

/**
 * JSON for logs. Never throws, and never prints a client: an error's context may hold whatever the
 * throw site put there.
 * - bigint -> `"123n"`
 * - an object already being printed further up -> `"[Circular]"`
 * - anything with a `request` function (viem clients, EIP-1193 providers) -> `"[Client]"`, since
 *   those carry the RPC URL, which often embeds an API key
 */
const safeJsonStringify = (value: unknown): string => {
  const ancestors: object[] = [];

  return JSON.stringify(value, function (this: unknown, _key, value) {
    if (typeof value === 'bigint') return `${value}n`;
    if (typeof value !== 'object' || value === null) return value;
    if (typeof (value as { request?: unknown }).request === 'function') return '[Client]';

    // `this` is the object holding `value`: drop the ancestors that are not on the path to it
    while (ancestors.length > 0 && ancestors[ancestors.length - 1] !== this) ancestors.pop();
    if (ancestors.includes(value)) return '[Circular]';
    ancestors.push(value);
    return value;
  });
};

/**
 * Whether `error` is a `CofheError`, and with `code`, whether it has that code.
 *
 * Unlike `instanceof CofheError` this also recognises an error created by another copy of the
 * SDK in the same process.
 *
 * @example
 * ```ts
 * if (isCofheError(error, CofheErrorCode.ACPNotFound)) await client.acp.getOrCreateSelfACP();
 * ```
 */
export function isCofheError<C extends CofheErrorCode>(error: unknown, code: C): error is CofheError & { code: C };
export function isCofheError(error: unknown): error is CofheError;
export function isCofheError(error: unknown, code?: CofheErrorCode): error is CofheError {
  const branded =
    typeof error === 'object' &&
    error !== null &&
    (error as { [COFHE_ERROR_BRAND]?: unknown })[COFHE_ERROR_BRAND] === true;
  return branded && (code === undefined || (error as CofheError).code === code);
}
