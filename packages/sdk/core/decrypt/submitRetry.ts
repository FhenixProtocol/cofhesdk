import { CofheError, CofheErrorCode } from '../error.js';
import { mapApiErrorCodeToCofheErrorCode, parseApiErrorResponseBody } from './apiError.js';

/** No retry of an access-denied answer unless the caller asks for one. */
export const DEFAULT_ACCESS_DENIED_RETRY_TIMEOUT_MS = 0;

export type SubmitRetryableStatus = 204;

export type SubmitResponseClassification =
  | { kind: 'retryable'; status: 204 }
  | { kind: 'parse-json' }
  | {
      kind: 'fatal-http';
      status: number;
      cofheErrorCode: CofheErrorCode;
      apiErrorCode?: string;
      errorMessage: string;
      hint?: string;
    };

export function normalizeAccessDeniedRetryTimeoutMs(params: {
  timeoutMs: number | undefined;
  operationLabel: string;
  errorCode: CofheErrorCode;
}): number {
  const { timeoutMs, operationLabel, errorCode } = params;

  if (timeoutMs === undefined) return DEFAULT_ACCESS_DENIED_RETRY_TIMEOUT_MS;

  if (!Number.isFinite(timeoutMs) || timeoutMs < 0) {
    throw new CofheError({
      code: errorCode,
      message: `${operationLabel} submit access-denied retry timeout must be a finite number greater than or equal to 0`,
      context: {
        timeoutMs,
      },
    });
  }

  return timeoutMs;
}

/**
 * The network answers "access denied" for a handle whose grant it has not seen yet, the same
 * way it does for a handle the caller may never read. Only the caller knows a grant is on its
 * way, so this is retried only inside the window the caller asked for (0 by default).
 */
export function shouldRetryAccessDenied(params: {
  apiErrorCode: string | undefined;
  elapsedMs: number;
  accessDeniedRetryTimeoutMs: number;
}): boolean {
  const { apiErrorCode, elapsedMs, accessDeniedRetryTimeoutMs } = params;
  if (apiErrorCode !== 'acp_denied' && apiErrorCode !== 'not_publicly_allowed') return false;
  return elapsedMs <= accessDeniedRetryTimeoutMs && accessDeniedRetryTimeoutMs > 0;
}

/**
 * Classifies a submit (POST) response into: bodyless-retryable 204, a 200 to be JSON-parsed, or a
 * fatal error carrying the mapped CofheErrorCode. Any 404 is fatal and maps to CtNotFound.
 */
export async function classifySubmitResponse(params: {
  response: Response;
  fallbackErrorCode: CofheErrorCode;
}): Promise<SubmitResponseClassification> {
  const { response, fallbackErrorCode } = params;

  // 204 is documented bodyless — never touch response.json() for it.
  if (response.status === 204) {
    return { kind: 'retryable', status: 204 };
  }

  if (response.ok) {
    return { kind: 'parse-json' };
  }

  const { apiErrorCode, errorMessage } = await parseApiErrorResponseBody(response);

  // A 404 means the network has no ciphertext for a handle the caller may read. That is a fault on
  // the network side, not a handle that needs more time, so it is never retried.
  if (response.status === 404) {
    return {
      kind: 'fatal-http',
      status: 404,
      cofheErrorCode: CofheErrorCode.CtNotFound,
      apiErrorCode: 'ct_not_found',
      errorMessage: `ciphertext not found: ${errorMessage}`,
      hint: 'The network has no ciphertext for this handle. Waiting does not help; check the chain and environment the handle belongs to.',
    };
  }

  return {
    kind: 'fatal-http',
    status: response.status,
    cofheErrorCode: mapApiErrorCodeToCofheErrorCode(apiErrorCode, fallbackErrorCode),
    apiErrorCode,
    errorMessage,
  };
}

export function throwIfSubmitRetryTimedOut(params: {
  operationLabel: string;
  errorCode: CofheErrorCode;
  status: SubmitRetryableStatus;
  elapsedMs: number;
  overallTimeoutMs: number;
  thresholdNetworkUrl: string;
  body: unknown;
  attemptIndex: number;
}): void {
  const { operationLabel, errorCode, status, elapsedMs, overallTimeoutMs, thresholdNetworkUrl, body, attemptIndex } =
    params;

  if (elapsedMs > overallTimeoutMs) {
    throw new CofheError({
      code: errorCode,
      message: `${operationLabel} submit retried without receiving request_id for ${overallTimeoutMs}ms`,
      hint: 'The ciphertext may still be propagating. Try again later.',
      context: {
        thresholdNetworkUrl,
        body,
        attemptIndex,
        timeoutMs: overallTimeoutMs,
        status,
      },
    });
  }
}
