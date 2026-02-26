import { type Permission } from '@/permits';

import { CofheError, CofheErrorCode } from '../error.js';

type DecryptResponse = {
  decrypted_value?: string | number;
  decryptedValue?: string | number;
  result?: string | number;
  signature?: string;
  error_message?: string | null;
  message?: string;
  is_succeed?: boolean;
};

function parseBigInt(value: unknown, fieldNameForError: string): bigint {
  if (typeof value === 'bigint') return value;
  if (typeof value === 'number') return BigInt(value);
  if (typeof value === 'string') {
    const trimmed = value.trim();
    if (trimmed.length === 0) {
      throw new CofheError({
        code: CofheErrorCode.DecryptReturnedNull,
        message: `decrypt response field <${fieldNameForError}> was an empty string`,
      });
    }
    // Support both hex (0x...) and decimal strings
    return BigInt(trimmed);
  }

  throw new CofheError({
    code: CofheErrorCode.DecryptReturnedNull,
    message: `decrypt response field <${fieldNameForError}> has unsupported type`,
    context: {
      fieldNameForError,
      typeofValue: typeof value,
      value,
    },
  });
}

function normalizeSignature(signature: unknown): string {
  if (typeof signature !== 'string') {
    throw new CofheError({
      code: CofheErrorCode.DecryptReturnedNull,
      message: 'decrypt response missing signature',
      context: {
        signature,
      },
    });
  }

  const trimmed = signature.trim();
  if (trimmed.length === 0) {
    throw new CofheError({
      code: CofheErrorCode.DecryptReturnedNull,
      message: 'decrypt response returned empty signature',
    });
  }

  // SDK uses "no-0x" signatures in mocks/tests; normalize to that format.
  return trimmed.startsWith('0x') ? trimmed.slice(2) : trimmed;
}

export async function tnDecrypt(
  ctHash: bigint,
  chainId: number,
  permission: Permission,
  thresholdNetworkUrl: string
): Promise<{ decryptedValue: bigint; signature: string }> {
  const body = {
    ct_tempkey: ctHash.toString(16).padStart(64, '0'),
    host_chain_id: chainId,
    permit: permission,
  };

  let response: Response;
  try {
    response = await fetch(`${thresholdNetworkUrl}/decrypt`, {
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
    console.log(`decrypt request failed with status ${response.status} ${response.statusText}`);
    console.log('Response body:', await response.text());
    console.log('Request body:', body);
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

  let decryptResponse: DecryptResponse;
  try {
    decryptResponse = (await response.json()) as DecryptResponse;
  } catch (e) {
    throw new CofheError({
      code: CofheErrorCode.DecryptFailed,
      message: `Failed to parse decrypt response`,
      cause: e instanceof Error ? e : undefined,
      context: {
        thresholdNetworkUrl,
        body,
      },
    });
  }

  if (decryptResponse.is_succeed === false) {
    const msg = decryptResponse.error_message || decryptResponse.message || 'Unknown error';
    throw new CofheError({
      code: CofheErrorCode.DecryptFailed,
      message: `decrypt request failed: ${msg}`,
      context: {
        thresholdNetworkUrl,
        body,
        decryptResponse,
      },
    });
  }

  const explicitErrorMessage = decryptResponse.error_message;
  if (typeof explicitErrorMessage === 'string' && explicitErrorMessage.length > 0) {
    throw new CofheError({
      code: CofheErrorCode.DecryptFailed,
      message: `decrypt request failed: ${explicitErrorMessage}`,
      context: {
        thresholdNetworkUrl,
        body,
        decryptResponse,
      },
    });
  }

  const decryptedValueRaw =
    decryptResponse.decrypted_value ?? decryptResponse.decryptedValue ?? decryptResponse.result ?? null;

  if (decryptedValueRaw == null) {
    throw new CofheError({
      code: CofheErrorCode.DecryptReturnedNull,
      message: `decrypt request returned no decrypted value`,
      context: {
        thresholdNetworkUrl,
        body,
        decryptResponse,
      },
    });
  }

  const decryptedValue = parseBigInt(
    decryptedValueRaw,
    decryptResponse.decrypted_value != null
      ? 'decrypted_value'
      : decryptResponse.decryptedValue != null
        ? 'decryptedValue'
        : 'result'
  );

  const signature = normalizeSignature(decryptResponse.signature);

  return {
    decryptedValue,
    signature,
  };
}
