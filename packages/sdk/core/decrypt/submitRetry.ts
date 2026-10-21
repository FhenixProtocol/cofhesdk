import { CofheError, CofheErrorCode } from '../error.js';
import { mapApiErrorCodeToCofheErrorCode, parseApiErrorResponseBody } from './apiError.js';

export const DEFAULT_404_RETRY_TIMEOUT_MS = 10_000;
/** The default budget of one decrypt, submit retries and status polling together. */
export const DEFAULT_DECRYPT_TIMEOUT_MS = 5 * 60 * 1000;

/**
 * Validates a builder's `setTimeout(timeoutMs)` argument: the overall budget must be a positive,
 * finite number of milliseconds (0 would time out before the first attempt).
 */
export function assertDecryptTimeoutMs(timeoutMs: number, operationLabel: string): void {
  if (!Number.isFinite(timeoutMs) || timeoutMs <= 0) {
    throw new CofheError({
      code: CofheErrorCode.InternalError,
      message: `${operationLabel}: setTimeout(timeoutMs) expects a finite number greater than 0.`,
      context: { timeoutMs },
    });
  }
}

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
 * Classifies a submit (POST) response into: bodyless-retryable 204, any 404 (still-indexing /
 * not-found — retryable under the 404 retry budget), a 200 to be JSON-parsed, or a fatal error
 * carrying the mapped CofheErrorCode.
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

  if (response.status === 404) {
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

/** The error a decrypt rejects with once its `AbortSignal` has fired. */
export function decryptAbortedError(operationLabel: string, signal: AbortSignal): CofheError {
  return new CofheError({
    code: CofheErrorCode.Aborted,
    message: `${operationLabel} aborted by the caller`,
    cause: signal.reason instanceof Error ? signal.reason : undefined,
  });
}

/** Rejects at once when `signal` has already fired, so an aborted call sends nothing more. */
export function throwIfAborted(signal: AbortSignal | undefined, operationLabel: string): void {
  if (signal?.aborted) throw decryptAbortedError(operationLabel, signal);
}

/** Waits `ms`, or rejects the moment `signal` fires: the wait between two attempts honours an abort. */
export function sleepUnlessAborted(ms: number, signal: AbortSignal | undefined, operationLabel: string): Promise<void> {
  return new Promise((resolve, reject) => {
    if (signal?.aborted) return reject(decryptAbortedError(operationLabel, signal));
    const onAbort = () => {
      clearTimeout(timer);
      reject(decryptAbortedError(operationLabel, signal!));
    };
    const timer = setTimeout(() => {
      signal?.removeEventListener('abort', onAbort);
      resolve();
    }, ms);
    signal?.addEventListener('abort', onAbort, { once: true });
  });
}
