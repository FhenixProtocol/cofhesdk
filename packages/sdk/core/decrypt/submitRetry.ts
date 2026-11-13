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
 * fatal error carrying the CofheErrorCode mapped from the body's error code. A 404 is fatal like
 * any other error status.
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

  const cofheErrorCode = mapApiErrorCodeToCofheErrorCode(apiErrorCode, fallbackErrorCode);

  return {
    kind: 'fatal-http',
    status: response.status,
    cofheErrorCode,
    apiErrorCode,
    errorMessage,
    // `ct_not_found` (sent with a 404) means the network has no ciphertext for a handle the caller
    // may read. That is a fault on the network side, not a handle that needs more time.
    hint:
      cofheErrorCode === CofheErrorCode.CtNotFound
        ? 'The network has no ciphertext for this handle. Waiting does not help; check the chain and environment the handle belongs to.'
        : undefined,
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
      message: `${operationLabel} result was not ready after retrying for ${overallTimeoutMs}ms`,
      hint: 'The network kept answering that the result is not ready yet. Try again later.',
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
