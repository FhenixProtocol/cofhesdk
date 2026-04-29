import { CofheError, CofheErrorCode } from '../error.js';

export const DEFAULT_404_RETRY_TIMEOUT_MS = 10_000;

export type SubmitRetryableStatus = 204 | 404;

export type SubmitResponseClassification =
  | { kind: 'retryable'; status: SubmitRetryableStatus }
  | { kind: 'parse-json' }
  | { kind: 'fatal-http'; errorMessage: string };

export function isRetryableSubmitStatus(status: number): status is SubmitRetryableStatus {
  return status === 204 || status === 404;
}

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

export async function classifySubmitResponse(params: {
  response: Response;
  extractErrorMessage?: (errorBody: unknown) => string | undefined;
}): Promise<SubmitResponseClassification> {
  const { response, extractErrorMessage } = params;

  if (isRetryableSubmitStatus(response.status)) {
    return { kind: 'retryable', status: response.status };
  }

  if (response.ok) {
    return { kind: 'parse-json' };
  }

  let errorMessage = `HTTP ${response.status}`;
  try {
    const errorBody = (await response.json()) as unknown;
    const maybeErrorMessage = extractErrorMessage?.(errorBody);
    if (typeof maybeErrorMessage === 'string' && maybeErrorMessage.length > 0) {
      errorMessage = maybeErrorMessage;
    } else if (errorBody && typeof errorBody === 'object') {
      const defaultMessage = (errorBody as Record<string, unknown>).error_message;
      const fallbackMessage = (errorBody as Record<string, unknown>).message;
      if (typeof defaultMessage === 'string' && defaultMessage.length > 0) {
        errorMessage = defaultMessage;
      } else if (typeof fallbackMessage === 'string' && fallbackMessage.length > 0) {
        errorMessage = fallbackMessage;
      }
    }
  } catch {
    errorMessage = response.statusText || errorMessage;
  }

  return { kind: 'fatal-http', errorMessage };
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
  } = params;

  if (status === 404 && elapsedMs > retry404TimeoutMs) {
    throw new CofheError({
      code: errorCode,
      message: `${operationLabel} submit retried 404 responses without receiving request_id for ${retry404TimeoutMs}ms`,
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
