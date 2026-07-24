import { CofheErrorCode } from '../error.js';

/**
 * Stable backend error codes returned by the threshold-network server's
 * `{ "error": "<stable_code>", "error_message": "<detail>" }` payload, see API-RESPONSES.md.
 * `ct_not_ready`/`overloaded` are excluded: v2 always represents those as a bodyless 204, so
 * they never reach this type.
 */
export type BackendApiErrorCode =
  | 'bad_request'
  | 'unknown_chain'
  | 'permit_malformed'
  | 'permit_denied'
  | 'permit_expired'
  | 'permit_invalid'
  | 'not_publicly_allowed'
  | 'ct_not_found'
  | 'unsupported_security_zone'
  | 'unsupported_type'
  | 'internal_error'
  | 'signing_failed'
  | 'ct_source_error'
  | 'permit_verifier_error'
  | 'ct_source_timeout'
  | 'permit_verifier_timeout'
  | 'permit_required'
  | 'seal_failed';

const BACKEND_ERROR_CODE_TO_COFHE_ERROR_CODE: Record<BackendApiErrorCode, CofheErrorCode> = {
  bad_request: CofheErrorCode.BadRequest,
  unknown_chain: CofheErrorCode.UnknownChain,
  permit_malformed: CofheErrorCode.PermitMalformed,
  permit_denied: CofheErrorCode.PermitDenied,
  permit_expired: CofheErrorCode.PermitExpired,
  permit_invalid: CofheErrorCode.PermitInvalid,
  not_publicly_allowed: CofheErrorCode.NotPubliclyAllowed,
  ct_not_found: CofheErrorCode.CtNotFound,
  unsupported_security_zone: CofheErrorCode.UnsupportedSecurityZone,
  unsupported_type: CofheErrorCode.UnsupportedType,
  internal_error: CofheErrorCode.InternalError,
  signing_failed: CofheErrorCode.SigningFailed,
  ct_source_error: CofheErrorCode.CtSourceError,
  permit_verifier_error: CofheErrorCode.PermitVerifierError,
  ct_source_timeout: CofheErrorCode.CtSourceTimeout,
  permit_verifier_timeout: CofheErrorCode.PermitVerifierTimeout,
  permit_required: CofheErrorCode.PermitRequired,
  seal_failed: CofheErrorCode.SealFailed,
};

function isBackendApiErrorCode(value: string): value is BackendApiErrorCode {
  return value in BACKEND_ERROR_CODE_TO_COFHE_ERROR_CODE;
}

export type ParsedApiError = {
  /** Raw `error` field from the backend body, verbatim, even if unrecognized. */
  apiErrorCode?: string;
  /** `error_message`, else `message`, else `HTTP <status>` / statusText. */
  errorMessage: string;
};

/**
 * Reads and parses a fetch Response's JSON error body per the shared `{ error, error_message }`
 * contract. Never throws — falls back to a status/statusText-derived message if the body isn't
 * JSON (e.g. axum framework rejections, which are plain text).
 */
export async function parseApiErrorResponseBody(response: Response): Promise<ParsedApiError> {
  let errorMessage = `HTTP ${response.status}`;
  let apiErrorCode: string | undefined;

  try {
    const body = (await response.json()) as unknown;
    if (body && typeof body === 'object') {
      const record = body as Record<string, unknown>;
      if (typeof record.error === 'string' && record.error.length > 0) {
        apiErrorCode = record.error;
      }
      if (typeof record.error_message === 'string' && record.error_message.length > 0) {
        errorMessage = record.error_message;
      } else if (typeof record.message === 'string' && record.message.length > 0) {
        errorMessage = record.message;
      }
    }
  } catch {
    errorMessage = response.statusText || errorMessage;
  }

  return { apiErrorCode, errorMessage };
}

/**
 * Maps a raw backend `error` string to a CofheErrorCode. Unrecognized or undefined codes fall
 * back to `fallback` so future/undocumented backend codes degrade gracefully instead of
 * throwing — the raw string is still preserved via `CofheError.apiErrorCode` on the resulting
 * error.
 */
export function mapApiErrorCodeToCofheErrorCode(
  apiErrorCode: string | undefined,
  fallback: CofheErrorCode
): CofheErrorCode {
  if (apiErrorCode && isBackendApiErrorCode(apiErrorCode)) {
    return BACKEND_ERROR_CODE_TO_COFHE_ERROR_CODE[apiErrorCode];
  }
  return fallback;
}
