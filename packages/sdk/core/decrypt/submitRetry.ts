import { CofheError, CofheErrorCode } from '../error.js';
import { mapApiErrorCodeToCofheErrorCode, parseApiErrorResponseBody } from './apiError.js';

export const DEFAULT_404_RETRY_TIMEOUT_MS = 10_000;

export type SubmitRetryableStatus = 204 | 404;

export type SubmitResponseClassification =
  | { kind: 'retryable'; status: 204 }
  | { kind: 'retryable'; status: 404; apiErrorMessage: string }
  | { kind: 'parse-json' }
  | {
      kind: 'fatal-http';
      status: number;
      cofheErrorCode: CofheErrorCode;
      apiErrorCode?: string;
      errorMessage: string;
    };

export function normalize404RetryTimeoutMs(params: {
  timeoutMs: number | undefined;
  operationLabel: string;
  errorCode: CofheErrorCode;
}): number {
  const { timeoutMs, operationLabel, errorCode } = params;

  if (timeoutMs === undefined) return DEFAULT_404_RETRY_TIMEOUT_MS;

  if (!Number.isFinite(timeoutMs) || timeoutMs < 0) {
    throw new CofheError({
      code: errorCode,
      message: `${operationLabel} submit 404 retry timeout must be a finite number greater than or equal to 0`,
      context: {
        timeoutMs,
      },
    });
  }

  return timeoutMs;
}

/**
 * Classifies a submit (POST) response into: bodyless-retryable 204, a 404 whose parsed body
 * reports `ct_not_found` (still-indexing ciphertext — retryable under the 404 retry budget),
 * a 200 to be JSON-parsed, or a fatal error carrying the mapped CofheErrorCode.
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

  // A 404 whose parsed error is exactly `ct_not_found` is still the "not indexed yet" case —
  // keep retrying it under the existing timeout budget. Anything else on 404 (a different code,
  // or an unparsable/empty body) is fatal immediately.
  if (response.status === 404 && apiErrorCode === 'ct_not_found') {
    return { kind: 'retryable', status: 404, apiErrorMessage: errorMessage };
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
  retry404TimeoutMs: number;
  overallTimeoutMs: number;
  thresholdNetworkUrl: string;
  body: unknown;
  attemptIndex: number;
  lastKnownErrorMessage?: string;
}): void {
  const {
    operationLabel,
    errorCode,
    status,
    elapsedMs,
    retry404TimeoutMs,
    overallTimeoutMs,
    thresholdNetworkUrl,
    body,
    attemptIndex,
    lastKnownErrorMessage,
  } = params;

  if (status === 404 && elapsedMs > retry404TimeoutMs) {
    throw new CofheError({
      code: CofheErrorCode.CtNotFound,
      apiErrorCode: 'ct_not_found',
      message:
        `${operationLabel} ciphertext not found after retrying for ${retry404TimeoutMs}ms` +
        (lastKnownErrorMessage ? `: ${lastKnownErrorMessage}` : ''),
      hint: 'The ciphertext may not be indexed yet. Increase set404RetryTimeout(...) if the backend is slow to index ciphertexts.',
      context: {
        thresholdNetworkUrl,
        body,
        attemptIndex,
        timeoutMs: retry404TimeoutMs,
        status,
      },
    });
  }

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
