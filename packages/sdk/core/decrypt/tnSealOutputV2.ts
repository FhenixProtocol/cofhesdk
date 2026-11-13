import { type ACPPublic, type EthEncryptedData } from '@/acps';
import { cofheFetch } from '../debug.js';

import { CofheError, CofheErrorCode } from '../error.js';
import { type DecryptPollCallbackFunction } from '../types.js';
import {
  classifySubmitResponse,
  normalizeAccessDeniedRetryTimeoutMs,
  shouldRetryAccessDenied,
  throwIfSubmitRetryTimedOut,
} from './submitRetry.js';

const SEAL_OUTPUT_TIMEOUT_MS = 5 * 60 * 1000; // 5 minutes total across submit retries
const SUBMIT_RETRY_INTERVAL_MS = 1000; // 1 second

// V2 API response types
type SealOutputSubmitResponse = {
  request_id: string | null;
  status?: string;
  is_succeed?: boolean;
  sealed?: {
    data: number[];
    public_key: number[];
    nonce: number[];
  };
  sealed_data?: number[];
  ephemeral_public_key?: number[];
  nonce?: number[];
  signature?: string;
  encryption_type?: number;
  error_message?: string | null;
  message?: string;
};

/**
 * Converts a number array to Uint8Array
 */
function numberArrayToUint8Array(arr: number[]): Uint8Array {
  return new Uint8Array(arr);
}

/**
 * Converts the sealed data from the API response to EthEncryptedData
 */
function convertSealedData(sealed: SealOutputSubmitResponse['sealed']): EthEncryptedData {
  if (!sealed) {
    throw new CofheError({
      code: CofheErrorCode.SealOutputReturnedNull,
      message: 'Sealed data is missing from the response',
    });
  }

  return {
    data: numberArrayToUint8Array(sealed.data),
    public_key: numberArrayToUint8Array(sealed.public_key),
    nonce: numberArrayToUint8Array(sealed.nonce),
  };
}

function getSealedDataFromSubmitResponse(
  value: SealOutputSubmitResponse
): SealOutputSubmitResponse['sealed'] | undefined {
  if (value.sealed) return value.sealed;

  if (Array.isArray(value.sealed_data) && Array.isArray(value.ephemeral_public_key) && Array.isArray(value.nonce)) {
    return {
      data: value.sealed_data,
      public_key: value.ephemeral_public_key,
      nonce: value.nonce,
    };
  }

  return undefined;
}

function parseCompletedSealOutputResponse(params: {
  value: SealOutputSubmitResponse;
  thresholdNetworkUrl: string;
  requestId?: string | null;
}): EthEncryptedData {
  const { value, thresholdNetworkUrl, requestId } = params;

  if (value.is_succeed === false) {
    const errorMessage = value.error_message || 'Unknown error';
    throw new CofheError({
      code: CofheErrorCode.SealOutputFailed,
      message: `sealOutput request failed: ${errorMessage}`,
      context: {
        thresholdNetworkUrl,
        requestId,
        response: value,
      },
    });
  }

  const sealed = getSealedDataFromSubmitResponse(value);

  if (!sealed) {
    throw new CofheError({
      code: CofheErrorCode.SealOutputReturnedNull,
      message: `sealOutput response has no sealed data`,
      context: {
        thresholdNetworkUrl,
        requestId,
        response: value,
      },
    });
  }

  return convertSealedData(sealed);
}

/**
 * Submits a sealoutput request to the v2 API and returns the sealed result. A 204 (result not
 * ready) and, when the caller asked for it, an access denial are retried.
 */
async function submitSealOutputRequest(
  thresholdNetworkUrl: string,
  ctHash: bigint | string,
  chainId: number,
  acp: ACPPublic,
  overallStartTime: number,
  accessDeniedRetryTimeoutMs: number,
  onPoll?: DecryptPollCallbackFunction
): Promise<EthEncryptedData> {
  const body = {
    ct_tempkey: BigInt(ctHash).toString(16).padStart(64, '0'),
    host_chain_id: chainId,
    acp,
  };
  let attemptIndex = 0;

  for (;;) {
    let response: Response;
    try {
      response = await cofheFetch(
        `${thresholdNetworkUrl}/v2/sealoutput`,
        /*op:sealoutput*/ {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(body),
        }
      );
    } catch (e) {
      throw new CofheError({
        code: CofheErrorCode.SealOutputFailed,
        message: `sealOutput request failed`,
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
      fallbackErrorCode: CofheErrorCode.SealOutputFailed,
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
          operation: 'sealoutput',
          requestId: '',
          attemptIndex,
          elapsedMs,
          intervalMs: SUBMIT_RETRY_INTERVAL_MS,
          timeoutMs: SEAL_OUTPUT_TIMEOUT_MS,
        });
        await new Promise((resolve) => setTimeout(resolve, SUBMIT_RETRY_INTERVAL_MS));
        attemptIndex += 1;
        continue;
      }

      throw new CofheError({
        code: responseClassification.cofheErrorCode,
        apiErrorCode: responseClassification.apiErrorCode,
        message: `sealOutput request failed: ${responseClassification.errorMessage}`,
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
      let submitResponse: SealOutputSubmitResponse;
      try {
        submitResponse = (await response.json()) as SealOutputSubmitResponse;
      } catch (e) {
        throw new CofheError({
          code: CofheErrorCode.SealOutputFailed,
          message: `Failed to parse sealOutput submit response`,
          cause: e instanceof Error ? e : undefined,
          context: {
            thresholdNetworkUrl,
            body,
            attemptIndex,
          },
        });
      }

      // The network answers a sealoutput in this one response: a 200 carries the result.
      return parseCompletedSealOutputResponse({
        value: submitResponse,
        thresholdNetworkUrl,
        requestId: submitResponse.request_id,
      });
    }

    const elapsedMs = Date.now() - overallStartTime;

    throwIfSubmitRetryTimedOut({
      operationLabel: 'sealOutput',
      errorCode: CofheErrorCode.SealOutputFailed,
      status: responseClassification.status,
      elapsedMs,
      overallTimeoutMs: SEAL_OUTPUT_TIMEOUT_MS,
      thresholdNetworkUrl,
      body,
      attemptIndex,
    });

    onPoll?.({
      operation: 'sealoutput',
      requestId: '',
      attemptIndex,
      elapsedMs,
      intervalMs: SUBMIT_RETRY_INTERVAL_MS,
      timeoutMs: SEAL_OUTPUT_TIMEOUT_MS,
    });

    await new Promise((resolve) => setTimeout(resolve, SUBMIT_RETRY_INTERVAL_MS));
    attemptIndex += 1;
  }
}

export async function tnSealOutputV2(params: {
  ctHash: bigint | string;
  chainId: number;
  acp: ACPPublic;
  thresholdNetworkUrl: string;
  accessDeniedRetryTimeoutMs?: number;
  onPoll?: DecryptPollCallbackFunction;
}): Promise<EthEncryptedData> {
  const { thresholdNetworkUrl, ctHash, chainId, acp, accessDeniedRetryTimeoutMs, onPoll } = params;
  const normalizedAccessDeniedRetryTimeoutMs = normalizeAccessDeniedRetryTimeoutMs({
    timeoutMs: accessDeniedRetryTimeoutMs,
    operationLabel: 'sealOutput',
    errorCode: CofheErrorCode.SealOutputFailed,
  });
  return await submitSealOutputRequest(
    thresholdNetworkUrl,
    ctHash,
    chainId,
    acp,
    Date.now(),
    normalizedAccessDeniedRetryTimeoutMs,
    onPoll
  );
}
