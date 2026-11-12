import { type ACPPublic } from '@/acps';
import { cofheFetch } from '../debug.js';

import { CofheError, CofheErrorCode } from '../error';
import { type DecryptPollCallbackFunction } from '../types';
import { normalizeTnSignature, parseDecryptedBytesToBigInt } from './tnDecryptUtils';
import {
  classifySubmitResponse,
  normalizeAccessDeniedRetryTimeoutMs,
  shouldRetryAccessDenied,
  throwIfSubmitRetryTimedOut,
} from './submitRetry.js';

const DECRYPT_TIMEOUT_MS = 5 * 60 * 1000; // 5 minutes total across submit retries
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
  value: Pick<DecryptSubmitResponseV2, 'decrypted' | 'signature' | 'error_message' | 'is_succeed'>;
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
      message: 'decrypt response missing <decrypted> byte array',
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

async function submitDecryptRequestV2(
  thresholdNetworkUrl: string,
  ctHash: bigint | string,
  chainId: number,
  acp: ACPPublic | null,
  overallStartTime: number,
  accessDeniedRetryTimeoutMs: number,
  onPoll?: DecryptPollCallbackFunction
): Promise<{ decryptedValue: bigint; signature: `0x${string}` }> {
  const body: {
    ct_tempkey: string;
    host_chain_id: number;
    acp?: ACPPublic;
  } = {
    ct_tempkey: BigInt(ctHash).toString(16).padStart(64, '0'),
    host_chain_id: chainId,
  };

  if (acp) {
    body.acp = acp;
  }

  let attemptIndex = 0;

  for (;;) {
    let response: Response;
    try {
      response = await cofheFetch(
        `${thresholdNetworkUrl}/v2/decrypt`,
        /*op:decrypt*/ {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(body),
        }
      );
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

    const responseClassification = await classifySubmitResponse({
      response,
      fallbackErrorCode: CofheErrorCode.DecryptFailed,
    });

    if (responseClassification.kind === 'fatal-http') {
      const elapsedMs = Date.now() - overallStartTime;
      if (
        shouldRetryAccessDenied({
          apiErrorCode: responseClassification.apiErrorCode,
          elapsedMs,
          accessDeniedRetryTimeoutMs,
        })
      ) {
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
        code: responseClassification.cofheErrorCode,
        apiErrorCode: responseClassification.apiErrorCode,
        message: `decrypt request failed: ${responseClassification.errorMessage}`,
        hint: responseClassification.hint ?? 'Check the threshold network URL and request parameters.',
        context: {
          thresholdNetworkUrl,
          status: responseClassification.status,
          body,
          attemptIndex,
        },
      });
    }

    if (responseClassification.kind === 'parse-json') {
      let submitResponse: DecryptSubmitResponseV2;
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

      // The network answers a decrypt in this one response: a 200 carries the result.
      return parseCompletedDecryptResponseV2({
        value: submitResponse,
        thresholdNetworkUrl,
        requestId: submitResponse.request_id,
      });
    }

    const elapsedMs = Date.now() - overallStartTime;

    throwIfSubmitRetryTimedOut({
      operationLabel: 'decrypt',
      errorCode: CofheErrorCode.DecryptFailed,
      status: responseClassification.status,
      elapsedMs,
      overallTimeoutMs: DECRYPT_TIMEOUT_MS,
      thresholdNetworkUrl,
      body,
      attemptIndex,
    });

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
  }
}

export async function tnDecryptV2(params: {
  ctHash: bigint | string;
  chainId: number;
  acp: ACPPublic | null;
  thresholdNetworkUrl: string;
  accessDeniedRetryTimeoutMs?: number;
  onPoll?: DecryptPollCallbackFunction;
}): Promise<{ decryptedValue: bigint; signature: `0x${string}` }> {
  const { thresholdNetworkUrl, ctHash, chainId, acp, accessDeniedRetryTimeoutMs, onPoll } = params;
  const normalizedAccessDeniedRetryTimeoutMs = normalizeAccessDeniedRetryTimeoutMs({
    timeoutMs: accessDeniedRetryTimeoutMs,
    operationLabel: 'decrypt',
    errorCode: CofheErrorCode.DecryptFailed,
  });
  return await submitDecryptRequestV2(
    thresholdNetworkUrl,
    ctHash,
    chainId,
    acp,
    Date.now(),
    normalizedAccessDeniedRetryTimeoutMs,
    onPoll
  );
}
