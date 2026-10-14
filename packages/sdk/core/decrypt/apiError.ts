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
  | 'acp_malformed'
  | 'acp_denied'
  | 'acp_expired'
  | 'acp_invalid'
  | 'acp_required'
  | 'acp_verifier_error'
  | 'acp_verifier_timeout'
  | 'not_publicly_allowed'
  | 'ct_not_found'
  | 'unsupported_security_zone'
  | 'unsupported_type'
  | 'internal_error'
  | 'signing_failed'
  | 'ct_source_error'
  | 'ct_source_timeout'
  | 'seal_failed';

const BACKEND_ERROR_CODE_TO_COFHE_ERROR_CODE: Record<BackendApiErrorCode, CofheErrorCode> = {
  bad_request: CofheErrorCode.BadRequest,
  unknown_chain: CofheErrorCode.UnknownChain,
  acp_malformed: CofheErrorCode.ACPMalformed,
  acp_denied: CofheErrorCode.ACPDenied, // ACP-era backends fold revoked into denied
  acp_expired: CofheErrorCode.ACPExpired,
  acp_invalid: CofheErrorCode.ACPInvalid,
  acp_required: CofheErrorCode.ACPRequired,
  acp_verifier_error: CofheErrorCode.ACPVerifierError,
  acp_verifier_timeout: CofheErrorCode.ACPVerifierTimeout,
  not_publicly_allowed: CofheErrorCode.NotPubliclyAllowed,
  ct_not_found: CofheErrorCode.CtNotFound,
  unsupported_security_zone: CofheErrorCode.UnsupportedSecurityZone,
  unsupported_type: CofheErrorCode.UnsupportedType,
  internal_error: CofheErrorCode.InternalError,
  signing_failed: CofheErrorCode.SigningFailed,
  ct_source_error: CofheErrorCode.CtSourceError,
  ct_source_timeout: CofheErrorCode.CtSourceTimeout,
  seal_failed: CofheErrorCode.SealFailed,
};

function isBackendApiErrorCode(value: string): value is BackendApiErrorCode {
  // Own-property check, not `in`: `in` also matches Object.prototype keys, so codes like
  // `toString` or `constructor` would be treated as recognised and the lookup would return a
  // function instead of a CofheErrorCode.
  return Object.prototype.hasOwnProperty.call(BACKEND_ERROR_CODE_TO_COFHE_ERROR_CODE, value);
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
