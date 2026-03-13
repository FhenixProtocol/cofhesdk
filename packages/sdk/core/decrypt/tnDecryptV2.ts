import { type Permission } from '@/permits';

import { CofheError, CofheErrorCode } from '../error';
import { normalizeTnSignature, parseDecryptedBytesToBigInt } from './tnDecryptUtils';

// Polling configuration
const POLL_INTERVAL_MS = 1000; // 1 second
const POLL_TIMEOUT_MS = 5 * 60 * 1000; // 5 minutes

type DecryptSubmitResponseV2 = {
  request_id: string;
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
  if (typeof v.request_id !== 'string' || v.request_id.trim().length === 0) {
    throw new CofheError({
      code: CofheErrorCode.DecryptFailed,
      message: 'decrypt submit response missing request_id',
      context: {
        value,
      },
    });
  }

  return { request_id: v.request_id };
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
  permission: Permission | null
): Promise<string> {
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
      },
    });
  }

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
      },
    });
  }

  const submitResponse = assertDecryptSubmitResponseV2(rawJson);
  return submitResponse.request_id;
}

async function pollDecryptStatusV2(
  thresholdNetworkUrl: string,
  requestId: string
): Promise<{ decryptedValue: bigint; signature: `0x${string}` }> {
  const startTime = Date.now();
  let completed = false;

  while (!completed) {
    if (Date.now() - startTime > POLL_TIMEOUT_MS) {
      throw new CofheError({
        code: CofheErrorCode.DecryptFailed,
        message: `decrypt polling timed out after ${POLL_TIMEOUT_MS}ms`,
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

    await new Promise((resolve) => setTimeout(resolve, POLL_INTERVAL_MS));
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

export async function tnDecryptV2(
  ctHash: bigint | string,
  chainId: number,
  permission: Permission | null,
  thresholdNetworkUrl: string
): Promise<{ decryptedValue: bigint; signature: `0x${string}` }> {
  const requestId = await submitDecryptRequestV2(thresholdNetworkUrl, ctHash, chainId, permission);
  return await pollDecryptStatusV2(thresholdNetworkUrl, requestId);
}
