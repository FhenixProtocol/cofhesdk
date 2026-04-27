import { type Permission } from '@/permits';

import { CofheError, CofheErrorCode } from '../error';
import { type DecryptPollCallbackFunction } from '../types';
import { normalizeTnSignature, parseDecryptedBytesToBigInt } from './tnDecryptUtils';
import { computeMinuteRampPollIntervalMs } from './polling.js';

// Polling configuration
const POLL_INTERVAL_MS = 1000; // 1 second
const POLL_MAX_INTERVAL_MS = 10_000; // 10 seconds
const DECRYPT_TIMEOUT_MS = 5 * 60 * 1000; // 5 minutes total across submit + poll
const SUBMIT_RETRY_INTERVAL_MS = 1000; // 1 second

type DecryptSubmitResponseV2 = {
  request_id: string | null;
  status?: string;
  is_succeed?: boolean;
  decrypted?: number[];
  signature?: string;
  encryption_type?: number;
  error_message?: string | null;
  message?: string;
};

type DecryptSubmitResultV2 =
  | { kind: 'request_id'; requestId: string }
  | { kind: 'completed'; decryptedValue: bigint; signature: `0x${string}` };

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
    is_succeed: typeof v.is_succeed === 'boolean' ? v.is_succeed : undefined,
    decrypted: Array.isArray(v.decrypted) ? (v.decrypted as number[]) : undefined,
    signature: typeof v.signature === 'string' ? v.signature : undefined,
    encryption_type: typeof v.encryption_type === 'number' ? v.encryption_type : undefined,
    error_message: typeof v.error_message === 'string' || v.error_message === null ? v.error_message : undefined,
    message: typeof v.message === 'string' ? v.message : undefined,
  };
}

function parseCompletedDecryptResponseV2(params: {
  value: Pick<DecryptStatusResponseV2, 'decrypted' | 'signature' | 'error_message' | 'is_succeed'>;
  thresholdNetworkUrl: string;
  requestId?: string | null;
}): { decryptedValue: bigint; signature: `0x${string}` } {
  const { value, thresholdNetworkUrl, requestId } = params;

  if (value.is_succeed === false) {
    const errorMessage = value.error_message || 'Unknown error';
    throw new CofheError({
      code: CofheErrorCode.DecryptFailed,
      message: `decrypt request failed: ${errorMessage}`,
      context: {
        thresholdNetworkUrl,
        requestId,
        response: value,
      },
    });
  }

  if (value.error_message) {
    throw new CofheError({
      code: CofheErrorCode.DecryptFailed,
      message: `decrypt request failed: ${value.error_message}`,
      context: {
        thresholdNetworkUrl,
        requestId,
        response: value,
      },
    });
  }

  if (!Array.isArray(value.decrypted)) {
    throw new CofheError({
      code: CofheErrorCode.DecryptReturnedNull,
      message: 'decrypt completed but response missing <decrypted> byte array',
      context: {
        thresholdNetworkUrl,
        requestId,
        response: value,
      },
    });
  }

  const decryptedValue = parseDecryptedBytesToBigInt(value.decrypted);
  const signature = normalizeTnSignature(value.signature);
  return { decryptedValue, signature };
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

async function submitDecryptRequestV2(
  thresholdNetworkUrl: string,
  ctHash: bigint | string,
  chainId: number,
  permission: Permission | null,
  overallStartTime: number,
  onPoll?: DecryptPollCallbackFunction
): Promise<DecryptSubmitResultV2> {
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

  let attemptIndex = 0;

  for (;;) {
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
          attemptIndex,
        },
      });
    }

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
          attemptIndex,
        },
      });
    }

    let submitResponse: DecryptSubmitResponseV2 | undefined;
    if (response.status !== 204) {
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
            attemptIndex,
          },
        });
      }

      submitResponse = assertDecryptSubmitResponseV2(rawJson);

      if (Array.isArray(submitResponse.decrypted) && typeof submitResponse.signature === 'string') {
        return {
          kind: 'completed',
          ...parseCompletedDecryptResponseV2({
            value: submitResponse,
            thresholdNetworkUrl,
            requestId: submitResponse.request_id,
          }),
        };
      }

      if (submitResponse.request_id) {
        return { kind: 'request_id', requestId: submitResponse.request_id };
      }
    }

    // 204 means backend is aware of ct hash but didn't calculate it yet
    if (response.status === 204) {
      const elapsedMs = Date.now() - overallStartTime;
      if (elapsedMs > DECRYPT_TIMEOUT_MS) {
        throw new CofheError({
          code: CofheErrorCode.DecryptFailed,
          message: `decrypt submit retried without receiving request_id for ${DECRYPT_TIMEOUT_MS}ms`,
          hint: 'The ciphertext may still be propagating. Try again later.',
          context: {
            thresholdNetworkUrl,
            body,
            attemptIndex,
            timeoutMs: DECRYPT_TIMEOUT_MS,
            submitResponse,
            status: response.status,
          },
        });
      }

      onPoll?.({
        operation: 'decrypt',
        requestId: '',
        attemptIndex,
        elapsedMs,
        intervalMs: SUBMIT_RETRY_INTERVAL_MS,
        timeoutMs: DECRYPT_TIMEOUT_MS,
      });

      await new Promise((resolve) => setTimeout(resolve, SUBMIT_RETRY_INTERVAL_MS));
      attemptIndex += 1;
      continue;
    }

    throw new CofheError({
      code: CofheErrorCode.DecryptFailed,
      message: `decrypt submit response missing request_id`,
      context: {
        thresholdNetworkUrl,
        body,
        submitResponse,
        attemptIndex,
      },
    });
  }
}

async function pollDecryptStatusV2(
  thresholdNetworkUrl: string,
  requestId: string,
  overallStartTime: number,
  onPoll?: DecryptPollCallbackFunction
): Promise<{ decryptedValue: bigint; signature: `0x${string}` }> {
  let attemptIndex = 0;
  let completed = false;

  while (!completed) {
    const elapsedMs = Date.now() - overallStartTime;
    const intervalMs = computeMinuteRampPollIntervalMs(elapsedMs, {
      minIntervalMs: POLL_INTERVAL_MS,
      maxIntervalMs: POLL_MAX_INTERVAL_MS,
    });
    onPoll?.({
      operation: 'decrypt',
      requestId,
      attemptIndex,
      elapsedMs,
      intervalMs,
      timeoutMs: DECRYPT_TIMEOUT_MS,
    });

    if (elapsedMs > DECRYPT_TIMEOUT_MS) {
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
    }

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

    const statusResponse = assertDecryptStatusResponseV2(rawJson);

    if (statusResponse.status === 'COMPLETED') {
      return parseCompletedDecryptResponseV2({
        value: statusResponse,
        thresholdNetworkUrl,
        requestId,
      });
    }

    await new Promise((resolve) => setTimeout(resolve, intervalMs));
    attemptIndex += 1;
  }

  // This should never be reached, but keeps TS and linters happy.
  throw new CofheError({
    code: CofheErrorCode.DecryptFailed,
    message: 'Polling loop exited unexpectedly',
    context: {
      thresholdNetworkUrl,
      requestId,
    },
  });
}

export async function tnDecryptV2(params: {
  ctHash: bigint | string;
  chainId: number;
  permission: Permission | null;
  thresholdNetworkUrl: string;
  onPoll?: DecryptPollCallbackFunction;
}): Promise<{ decryptedValue: bigint; signature: `0x${string}` }> {
  const { thresholdNetworkUrl, ctHash, chainId, permission, onPoll } = params;
  const overallStartTime = Date.now();
  const submitResult = await submitDecryptRequestV2(
    thresholdNetworkUrl,
    ctHash,
    chainId,
    permission,
    overallStartTime,
    onPoll
  );

  if (submitResult.kind === 'completed') {
    return submitResult;
  }

  return await pollDecryptStatusV2(thresholdNetworkUrl, submitResult.requestId, overallStartTime, onPoll);
}
