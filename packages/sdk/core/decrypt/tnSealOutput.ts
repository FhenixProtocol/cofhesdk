import { type Permission, type EthEncryptedData } from '@/permits';

import { CofhesdkError, CofhesdkErrorCode } from '../error.js';

// Polling configuration
const POLL_INTERVAL_MS = 1000; // 1 second
const POLL_TIMEOUT_MS = 5 * 60 * 1000; // 5 minutes

// V2 API response types
type SealOutputSubmitResponse = {
  request_id: string;
};

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
    throw new CofhesdkError({
      code: CofhesdkErrorCode.SealOutputReturnedNull,
      message: 'Sealed data is missing from completed response',
    });
  }

  return {
    data: numberArrayToUint8Array(sealed.data),
    public_key: numberArrayToUint8Array(sealed.public_key),
    nonce: numberArrayToUint8Array(sealed.nonce),
  };
}

/**
 * Submits a sealoutput request to the v2 API and returns the request_id
 */
async function submitSealOutputRequest(
  thresholdNetworkUrl: string,
  ctHash: bigint,
  chainId: number,
  permission: Permission
): Promise<string> {
  const body = {
    ct_tempkey: ctHash.toString(16).padStart(64, '0'),
    host_chain_id: chainId,
    permit: permission,
  };

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
    throw new CofhesdkError({
      code: CofhesdkErrorCode.SealOutputFailed,
      message: `sealOutput request failed`,
      hint: 'Ensure the threshold network URL is valid and reachable.',
      cause: e instanceof Error ? e : undefined,
      context: {
        thresholdNetworkUrl,
        body,
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
      // Ignore JSON parse errors, use status text
      errorMessage = response.statusText || errorMessage;
    }

    throw new CofhesdkError({
      code: CofhesdkErrorCode.SealOutputFailed,
      message: `sealOutput request failed: ${errorMessage}`,
      hint: 'Check the threshold network URL and request parameters.',
      context: {
        thresholdNetworkUrl,
        status: response.status,
        statusText: response.statusText,
        body,
      },
    });
  }

  let submitResponse: SealOutputSubmitResponse;
  try {
    submitResponse = (await response.json()) as SealOutputSubmitResponse;
  } catch (e) {
    throw new CofhesdkError({
      code: CofhesdkErrorCode.SealOutputFailed,
      message: `Failed to parse sealOutput submit response`,
      cause: e instanceof Error ? e : undefined,
      context: {
        thresholdNetworkUrl,
        body,
      },
    });
  }

  if (!submitResponse.request_id) {
    throw new CofhesdkError({
      code: CofhesdkErrorCode.SealOutputFailed,
      message: `sealOutput submit response missing request_id`,
      context: {
        thresholdNetworkUrl,
        body,
        submitResponse,
      },
    });
  }

  return submitResponse.request_id;
}

/**
 * Polls for the sealoutput status until completed or timeout
 */
async function pollSealOutputStatus(thresholdNetworkUrl: string, requestId: string): Promise<EthEncryptedData> {
  const startTime = Date.now();
  let completed = false;

  while (!completed) {
    // Check timeout
    if (Date.now() - startTime > POLL_TIMEOUT_MS) {
      throw new CofhesdkError({
        code: CofhesdkErrorCode.SealOutputFailed,
        message: `sealOutput polling timed out after ${POLL_TIMEOUT_MS}ms`,
        hint: 'The request may still be processing. Try again later.',
        context: {
          thresholdNetworkUrl,
          requestId,
          timeoutMs: POLL_TIMEOUT_MS,
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
      throw new CofhesdkError({
        code: CofhesdkErrorCode.SealOutputFailed,
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
      throw new CofhesdkError({
        code: CofhesdkErrorCode.SealOutputFailed,
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

      throw new CofhesdkError({
        code: CofhesdkErrorCode.SealOutputFailed,
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
      throw new CofhesdkError({
        code: CofhesdkErrorCode.SealOutputFailed,
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
      // Check if succeeded
      if (statusResponse.is_succeed === false) {
        const errorMessage = statusResponse.error_message || 'Unknown error';
        throw new CofhesdkError({
          code: CofhesdkErrorCode.SealOutputFailed,
          message: `sealOutput request failed: ${errorMessage}`,
          context: {
            thresholdNetworkUrl,
            requestId,
            statusResponse,
          },
        });
      }

      // Check if sealed data exists
      if (!statusResponse.sealed) {
        throw new CofhesdkError({
          code: CofhesdkErrorCode.SealOutputReturnedNull,
          message: `sealOutput request completed but returned no sealed data`,
          context: {
            thresholdNetworkUrl,
            requestId,
            statusResponse,
          },
        });
      }

      // Convert and return the sealed data
      return convertSealedData(statusResponse.sealed);
    }

    // Still processing, wait before next poll
    await new Promise((resolve) => setTimeout(resolve, POLL_INTERVAL_MS));
  }

  // This should never be reached, but TypeScript requires it
  throw new CofhesdkError({
    code: CofhesdkErrorCode.SealOutputFailed,
    message: 'Polling loop exited unexpectedly',
    context: {
      thresholdNetworkUrl,
      requestId,
    },
  });
}

export async function tnSealOutput(
  ctHash: bigint,
  chainId: number,
  permission: Permission,
  thresholdNetworkUrl: string
): Promise<EthEncryptedData> {
  // Step 1: Submit the request and get request_id
  const requestId = await submitSealOutputRequest(thresholdNetworkUrl, ctHash, chainId, permission);

  // Step 2: Poll for status until completed
  return await pollSealOutputStatus(thresholdNetworkUrl, requestId);
}
