import { type Permission } from '@/permits';

import { CofheError, CofheErrorCode } from '../error';
import { type DecryptPollCallbackFunction, type DecryptPollMetrics } from '../types';
import { normalizeTnSignature, parseDecryptedBytesToBigInt } from './tnDecryptUtils';
import { computeMinuteRampPollIntervalMs } from './polling.js';

// Polling configuration
const POLL_INTERVAL_MS = 1000; // 1 second
const POLL_MAX_INTERVAL_MS = 10_000; // 10 seconds
const DECRYPT_TIMEOUT_MS = 5 * 60 * 1000; // 5 minutes total across submit + poll

type DecryptSubmitResponseV2 = {
  request_id: string | null;
  status?: string;
  error_message?: string | null;
  message?: string;
};

type DecryptStatusResponseV2 = {
  request_id: string;
  status: 'PROCESSING' | 'COMPLETED';
  submitted_at: string;
  completed_at?: string;
  is_succeed?: boolean;
  decrypted?: number[];
  signature?: string;
  encryption_type?: number;
  error_message?: string | null;
};

function assertDecryptSubmitResponseV2(value: unknown): DecryptSubmitResponseV2 {
  if (value == null || typeof value !== 'object') {
    throw new CofheError({
      code: CofheErrorCode.DecryptFailed,
      message: 'decrypt submit response must be a JSON object',
      context: {
        value,
      },
    });
  }

  const v = value as Record<string, unknown>;
  if (v.request_id !== null && typeof v.request_id !== 'string') {
    throw new CofheError({
      code: CofheErrorCode.DecryptFailed,
      message: 'decrypt submit response has invalid request_id',
      context: {
        value,
      },
    });
  }

  return {
    request_id: v.request_id ?? null,
    status: typeof v.status === 'string' ? v.status : undefined,
    error_message: typeof v.error_message === 'string' || v.error_message === null ? v.error_message : undefined,
    message: typeof v.message === 'string' ? v.message : undefined,
  };
}

function assertDecryptStatusResponseV2(value: unknown): DecryptStatusResponseV2 {
  if (value == null || typeof value !== 'object') {
    throw new CofheError({
      code: CofheErrorCode.DecryptFailed,
      message: 'decrypt status response must be a JSON object',
      context: {
        value,
      },
    });
  }

  const v = value as Record<string, unknown>;

  const requestId = v.request_id;
  const status = v.status;
  const submittedAt = v.submitted_at;

  if (typeof requestId !== 'string' || requestId.trim().length === 0) {
    throw new CofheError({
      code: CofheErrorCode.DecryptFailed,
      message: 'decrypt status response missing request_id',
      context: {
        value,
      },
    });
  }

  if (status !== 'PROCESSING' && status !== 'COMPLETED') {
    throw new CofheError({
      code: CofheErrorCode.DecryptFailed,
      message: 'decrypt status response has invalid status',
      context: {
        value,
        status,
      },
    });
  }

  if (typeof submittedAt !== 'string' || submittedAt.trim().length === 0) {
    throw new CofheError({
      code: CofheErrorCode.DecryptFailed,
      message: 'decrypt status response missing submitted_at',
      context: {
        value,
      },
    });
  }

  return value as DecryptStatusResponseV2;
}

const POLL_CONTINUE: unique symbol = Symbol('continue');
type PollContinue = typeof POLL_CONTINUE;
const POLL_TIMEOUT: unique symbol = Symbol('timeout');
type PollTimeout = typeof POLL_TIMEOUT;

/// Requests decryption from CoFHE
/// Return options:
/// - 200 CACHE HIT: request_id returned with decrypt result
/// - 202 CACHE MISS: request_id returned, decryption triggered, move on to result polling
/// - 204 CT NOT READY: CT has not been calculated yet, poll again
/// - 404 NOT FOUND: Ct Not Found by cofhe
async function submitDecryptRequestV2(
  thresholdNetworkUrl: string,
  ctHash: bigint | string,
  chainId: number,
  permission: Permission | null,
  pollMetrics: DecryptPollMetrics,
  onPoll?: DecryptPollCallbackFunction
): Promise<string | PollContinue> {
  const body: {
    ct_tempkey: string;
    host_chain_id: number;
    permit?: Permission;
  } = {
    ct_tempkey: BigInt(ctHash).toString(16).padStart(64, '0'),
    host_chain_id: chainId,
  };

  if (permission) {
    body.permit = permission;
  }

  // Fetch
  let response: Response;
  try {
    response = await fetch(`${thresholdNetworkUrl}/v2/decrypt`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    });
  } catch (e) {
    throw new CofheError({
      code: CofheErrorCode.DecryptFailed,
      message: `decrypt request failed`,
      hint: 'Ensure the threshold network URL is valid and reachable.',
      cause: e instanceof Error ? e : undefined,
      context: {
        thresholdNetworkUrl,
        body,
        attemptIndex: pollMetrics.attemptIndex,
      },
    });
  }

  // Handle non-200 status codes
  if (!response.ok) {
    let errorMessage = `HTTP ${response.status}`;
    try {
      const errorBody = (await response.json()) as Record<string, unknown>;
      const maybeMessage = (errorBody.error_message || errorBody.message) as unknown;
      if (typeof maybeMessage === 'string' && maybeMessage.length > 0) errorMessage = maybeMessage;
    } catch {
      errorMessage = response.statusText || errorMessage;
    }

    throw new CofheError({
      code: CofheErrorCode.DecryptFailed,
      message: `decrypt request failed: ${errorMessage}`,
      hint: 'Check the threshold network URL and request parameters.',
      context: {
        thresholdNetworkUrl,
        status: response.status,
        statusText: response.statusText,
        body,
        attemptIndex: pollMetrics.attemptIndex,
      },
    });
  }

  // Poll if 204: CT NOT READY
  if (response.status === 204) {
    onPoll?.({
      operation: 'decrypt',
      requestId: undefined,
      ...pollMetrics,
    });
    return POLL_CONTINUE;
  }

  // Handle 200: CACHE HIT, decryption result is included in this response, we can handle it immediately
  // TODO

  // Parse response json and return request_id
  let rawJson: unknown;
  try {
    rawJson = (await response.json()) as unknown;
  } catch (e) {
    throw new CofheError({
      code: CofheErrorCode.DecryptFailed,
      message: `Failed to parse decrypt submit response`,
      cause: e instanceof Error ? e : undefined,
      context: {
        thresholdNetworkUrl,
        body,
        attemptIndex: pollMetrics.attemptIndex,
      },
    });
  }

  // Validate response
  const submitResponse = assertDecryptSubmitResponseV2(rawJson);

  if (submitResponse.request_id == null) {
    throw new CofheError({
      code: CofheErrorCode.DecryptFailed,
      message: `decrypt submit response missing request_id`,
      context: {
        thresholdNetworkUrl,
        body,
        submitResponse,
      },
    });
  }

  return submitResponse.request_id;
}

async function pollDecryptStatusV2(
  thresholdNetworkUrl: string,
  requestId: string,
  pollMetrics: DecryptPollMetrics,
  onPoll?: DecryptPollCallbackFunction
): Promise<{ decryptedValue: bigint; signature: `0x${string}` } | typeof POLL_CONTINUE> {
  onPoll?.({
    operation: 'decrypt',
    requestId,
    ...pollMetrics,
  });

  // Fetch
  let response: Response;
  try {
    response = await fetch(`${thresholdNetworkUrl}/v2/decrypt/${requestId}`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
    });
  } catch (e) {
    throw new CofheError({
      code: CofheErrorCode.DecryptFailed,
      message: `decrypt status poll failed`,
      hint: 'Ensure the threshold network URL is valid and reachable.',
      cause: e instanceof Error ? e : undefined,
      context: {
        thresholdNetworkUrl,
        requestId,
      },
    });
  }

  // Handle 404 - request not found
  if (response.status === 404) {
    throw new CofheError({
      code: CofheErrorCode.DecryptFailed,
      message: `decrypt request not found: ${requestId}`,
      hint: 'The request may have expired or been invalid.',
      context: {
        thresholdNetworkUrl,
        requestId,
      },
    });
  }

  // Handle other non-200 status codes
  if (!response.ok) {
    let errorMessage = `HTTP ${response.status}`;
    try {
      const errorBody = (await response.json()) as Record<string, unknown>;
      const maybeMessage = (errorBody.error_message || errorBody.message) as unknown;
      if (typeof maybeMessage === 'string' && maybeMessage.length > 0) errorMessage = maybeMessage;
    } catch {
      errorMessage = response.statusText || errorMessage;
    }

    throw new CofheError({
      code: CofheErrorCode.DecryptFailed,
      message: `decrypt status poll failed: ${errorMessage}`,
      context: {
        thresholdNetworkUrl,
        requestId,
        status: response.status,
        statusText: response.statusText,
      },
    });
  }

  // Parse response json
  let rawJson: unknown;
  try {
    rawJson = (await response.json()) as unknown;
  } catch (e) {
    throw new CofheError({
      code: CofheErrorCode.DecryptFailed,
      message: `Failed to parse decrypt status response`,
      cause: e instanceof Error ? e : undefined,
      context: {
        thresholdNetworkUrl,
        requestId,
      },
    });
  }

  // Validate response
  const statusResponse = assertDecryptStatusResponseV2(rawJson);

  // Handle completed
  if (statusResponse.status === 'COMPLETED') {
    if (statusResponse.is_succeed === false) {
      const errorMessage = statusResponse.error_message || 'Unknown error';
      throw new CofheError({
        code: CofheErrorCode.DecryptFailed,
        message: `decrypt request failed: ${errorMessage}`,
        context: {
          thresholdNetworkUrl,
          requestId,
          statusResponse,
        },
      });
    }

    if (statusResponse.error_message) {
      throw new CofheError({
        code: CofheErrorCode.DecryptFailed,
        message: `decrypt request failed: ${statusResponse.error_message}`,
        context: {
          thresholdNetworkUrl,
          requestId,
          statusResponse,
        },
      });
    }

    if (!Array.isArray(statusResponse.decrypted)) {
      throw new CofheError({
        code: CofheErrorCode.DecryptReturnedNull,
        message: 'decrypt completed but response missing <decrypted> byte array',
        context: {
          thresholdNetworkUrl,
          requestId,
          statusResponse,
        },
      });
    }

    const decryptedValue = parseDecryptedBytesToBigInt(statusResponse.decrypted);
    const signature = normalizeTnSignature(statusResponse.signature);
    return { decryptedValue, signature };
  }

  return POLL_CONTINUE;
}

async function doPoll<T>(
  fn: (pollMetrics: DecryptPollMetrics) => Promise<T | typeof POLL_CONTINUE>,
  options: {
    timeoutMs: number;
    minIntervalMs: number;
    maxIntervalMs: number;
  }
): Promise<typeof POLL_TIMEOUT | T> {
  const { timeoutMs, minIntervalMs, maxIntervalMs } = options;
  const startTime = Date.now();
  let attemptIndex = 0;

  while (true) {
    // Check timeout
    const elapsedMs = Date.now() - startTime;
    if (elapsedMs > timeoutMs) return POLL_TIMEOUT;

    // Execute poll function
    const resultOrContinue = await fn({
      attemptIndex,
      elapsedMs,
      intervalMs: computeMinuteRampPollIntervalMs(elapsedMs, {
        minIntervalMs,
        maxIntervalMs,
      }),
      timeoutMs,
    });

    // Result available, return it
    if (resultOrContinue !== POLL_CONTINUE) return resultOrContinue;

    // Poll again
    const intervalMs = computeMinuteRampPollIntervalMs(elapsedMs, {
      minIntervalMs,
      maxIntervalMs,
    });
    await new Promise((resolve) => setTimeout(resolve, intervalMs));
    attemptIndex += 1;
  }
}

export async function tnDecryptV2(params: {
  ctHash: bigint | string;
  chainId: number;
  permission: Permission | null;
  thresholdNetworkUrl: string;
  onPoll?: DecryptPollCallbackFunction;
}): Promise<{ decryptedValue: bigint; signature: `0x${string}` }> {
  const { thresholdNetworkUrl, ctHash, chainId, permission, onPoll } = params;

  let requestId: string | undefined = undefined;

  const result = await doPoll(
    async (pollMetrics: DecryptPollMetrics) => {
      const requestIdOrContinue =
        requestId != null
          ? requestId
          : await submitDecryptRequestV2(
              thresholdNetworkUrl,
              ctHash,
              chainId,
              permission,
              pollMetrics,
              onPoll
            );

      if (requestIdOrContinue === POLL_CONTINUE) return POLL_CONTINUE;
      requestId = requestIdOrContinue;

      return await pollDecryptStatusV2(thresholdNetworkUrl, requestId, pollMetrics, onPoll);
    },
    {
      timeoutMs: DECRYPT_TIMEOUT_MS,
      minIntervalMs: POLL_INTERVAL_MS,
      maxIntervalMs: POLL_MAX_INTERVAL_MS,
    }
  );

  if (result === POLL_TIMEOUT)
    throw new CofheError({
      code: CofheErrorCode.DecryptFailed,
      message: `decrypt polling timed out after ${DECRYPT_TIMEOUT_MS}ms`,
      hint: 'The request may still be processing. Try again later.',
      context: {
        thresholdNetworkUrl,
        requestId,
        timeoutMs: DECRYPT_TIMEOUT_MS,
      },
    });

  return result;
}
