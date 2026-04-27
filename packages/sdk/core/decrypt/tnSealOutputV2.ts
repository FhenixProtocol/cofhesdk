import { type Permission, type EthEncryptedData } from '@/permits';

import { CofheError, CofheErrorCode } from '../error.js';
import { type DecryptPollCallbackFunction } from '../types.js';
import { computeMinuteRampPollIntervalMs } from './polling.js';

// Polling configuration
const POLL_INTERVAL_MS = 1000; // 1 second
const POLL_MAX_INTERVAL_MS = 10_000; // 10 seconds
const SEAL_OUTPUT_TIMEOUT_MS = 5 * 60 * 1000; // 5 minutes total across submit + poll
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

type SealOutputSubmitResult =
  | { kind: 'request_id'; requestId: string }
  | { kind: 'completed'; sealed: EthEncryptedData };

type SealOutputStatusResponse = {
  request_id: string;
  status: 'PROCESSING' | 'COMPLETED';
  submitted_at: string;
  completed_at?: string;
  is_succeed?: boolean;
  sealed?: {
    data: number[];
    public_key: number[];
    nonce: number[];
  };
  signature?: string;
  encryption_type?: number;
  error_message?: string | null;
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
function convertSealedData(sealed: SealOutputStatusResponse['sealed']): EthEncryptedData {
  if (!sealed) {
    throw new CofheError({
      code: CofheErrorCode.SealOutputReturnedNull,
      message: 'Sealed data is missing from completed response',
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
): SealOutputStatusResponse['sealed'] | undefined {
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
  value: Pick<SealOutputStatusResponse, 'sealed' | 'error_message' | 'is_succeed'>;
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

  const sealed = 'sealed' in value ? value.sealed : getSealedDataFromSubmitResponse(value as SealOutputSubmitResponse);

  if (!sealed) {
    throw new CofheError({
      code: CofheErrorCode.SealOutputReturnedNull,
      message: `sealOutput request completed but returned no sealed data`,
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
 * Submits a sealoutput request to the v2 API and returns the request_id
 */
async function submitSealOutputRequest(
  thresholdNetworkUrl: string,
  ctHash: bigint | string,
  chainId: number,
  permission: Permission,
  overallStartTime: number,
  onPoll?: DecryptPollCallbackFunction
): Promise<SealOutputSubmitResult> {
  const body = {
    ct_tempkey: BigInt(ctHash).toString(16).padStart(64, '0'),
    host_chain_id: chainId,
    permit: permission,
  };
  let attemptIndex = 0;

  for (;;) {
    let response: Response;
    try {
      response = await fetch(`${thresholdNetworkUrl}/v2/sealoutput`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(body),
      });
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

    // Handle non-200 status codes
    if (!response.ok) {
      let errorMessage = `HTTP ${response.status}`;
      try {
        const errorBody = await response.json();

        errorMessage = errorBody.error_message || errorBody.message || errorMessage;
      } catch {
        errorMessage = response.statusText || errorMessage;
      }

      throw new CofheError({
        code: CofheErrorCode.SealOutputFailed,
        message: `sealOutput request failed: ${errorMessage}`,
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

    let submitResponse: SealOutputSubmitResponse | undefined;
    if (response.status !== 204) {
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

      if (getSealedDataFromSubmitResponse(submitResponse)) {
        return {
          kind: 'completed',
          sealed: parseCompletedSealOutputResponse({
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
      if (elapsedMs > SEAL_OUTPUT_TIMEOUT_MS) {
        throw new CofheError({
          code: CofheErrorCode.SealOutputFailed,
          message: `sealOutput submit retried without receiving request_id for ${SEAL_OUTPUT_TIMEOUT_MS}ms`,
          hint: 'The ciphertext may still be propagating. Try again later.',
          context: {
            thresholdNetworkUrl,
            body,
            attemptIndex,
            timeoutMs: SEAL_OUTPUT_TIMEOUT_MS,
            submitResponse,
            status: response.status,
          },
        });
      }

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
      code: CofheErrorCode.SealOutputFailed,
      message: `sealOutput submit response missing request_id`,
      context: {
        thresholdNetworkUrl,
        body,
        submitResponse,
        attemptIndex,
      },
    });
  }
}

/**
 * Polls for the sealoutput status until completed or timeout
 */
async function pollSealOutputStatus(
  thresholdNetworkUrl: string,
  requestId: string,
  overallStartTime: number,
  onPoll?: DecryptPollCallbackFunction
): Promise<EthEncryptedData> {
  let attemptIndex = 0;
  let completed = false;

  while (!completed) {
    const elapsedMs = Date.now() - overallStartTime;
    const intervalMs = computeMinuteRampPollIntervalMs(elapsedMs, {
      minIntervalMs: POLL_INTERVAL_MS,
      maxIntervalMs: POLL_MAX_INTERVAL_MS,
    });
    onPoll?.({
      operation: 'sealoutput',
      requestId,
      attemptIndex,
      elapsedMs,
      intervalMs,
      timeoutMs: SEAL_OUTPUT_TIMEOUT_MS,
    });

    // Check timeout
    if (elapsedMs > SEAL_OUTPUT_TIMEOUT_MS) {
      throw new CofheError({
        code: CofheErrorCode.SealOutputFailed,
        message: `sealOutput polling timed out after ${SEAL_OUTPUT_TIMEOUT_MS}ms`,
        hint: 'The request may still be processing. Try again later.',
        context: {
          thresholdNetworkUrl,
          requestId,
          timeoutMs: SEAL_OUTPUT_TIMEOUT_MS,
        },
      });
    }

    let response: Response;
    try {
      response = await fetch(`${thresholdNetworkUrl}/v2/sealoutput/${requestId}`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
      });
    } catch (e) {
      throw new CofheError({
        code: CofheErrorCode.SealOutputFailed,
        message: `sealOutput status poll failed`,
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
        code: CofheErrorCode.SealOutputFailed,
        message: `sealOutput request not found: ${requestId}`,
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
        const errorBody = await response.json();
        errorMessage = errorBody.error_message || errorBody.message || errorMessage;
      } catch {
        errorMessage = response.statusText || errorMessage;
      }

      throw new CofheError({
        code: CofheErrorCode.SealOutputFailed,
        message: `sealOutput status poll failed: ${errorMessage}`,
        context: {
          thresholdNetworkUrl,
          requestId,
          status: response.status,
          statusText: response.statusText,
        },
      });
    }

    let statusResponse: SealOutputStatusResponse;
    try {
      statusResponse = (await response.json()) as SealOutputStatusResponse;
    } catch (e) {
      throw new CofheError({
        code: CofheErrorCode.SealOutputFailed,
        message: `Failed to parse sealOutput status response`,
        cause: e instanceof Error ? e : undefined,
        context: {
          thresholdNetworkUrl,
          requestId,
        },
      });
    }

    // Check if completed
    if (statusResponse.status === 'COMPLETED') {
      return parseCompletedSealOutputResponse({
        value: statusResponse,
        thresholdNetworkUrl,
        requestId,
      });
    }

    // Still processing, wait before next poll
    await new Promise((resolve) => setTimeout(resolve, intervalMs));
    attemptIndex += 1;
  }

  // This should never be reached, but TypeScript requires it
  throw new CofheError({
    code: CofheErrorCode.SealOutputFailed,
    message: 'Polling loop exited unexpectedly',
    context: {
      thresholdNetworkUrl,
      requestId,
    },
  });
}

export async function tnSealOutputV2(params: {
  ctHash: bigint | string;
  chainId: number;
  permission: Permission;
  thresholdNetworkUrl: string;
  onPoll?: DecryptPollCallbackFunction;
}): Promise<EthEncryptedData> {
  const { thresholdNetworkUrl, ctHash, chainId, permission, onPoll } = params;
  const overallStartTime = Date.now();

  // Step 1: Submit the request and get request_id
  const submitResult = await submitSealOutputRequest(
    thresholdNetworkUrl,
    ctHash,
    chainId,
    permission,
    overallStartTime,
    onPoll
  );

  if (submitResult.kind === 'completed') {
    return submitResult.sealed;
  }

  // Step 2: Poll for status until completed
  return await pollSealOutputStatus(thresholdNetworkUrl, submitResult.requestId, overallStartTime, onPoll);
}
