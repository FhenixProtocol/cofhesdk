import { type Permission } from '@/permits';

import { CofheError, CofheErrorCode } from '../error.js';

type TnDecryptResponse = {
  // TN returns bytes in big-endian order, e.g. [0,0,0,42]
  decrypted: number[];
  signature: string;
  encryption_type: number;
  error_message: string | null;
};

function isTnDecryptDebugEnabled(): boolean {
  return (
    typeof process !== 'undefined' &&
    // eslint-disable-next-line turbo/no-undeclared-env-vars
    !!process.env.COFHE_DEBUG_TN_DECRYPT &&
    // eslint-disable-next-line turbo/no-undeclared-env-vars
    process.env.COFHE_DEBUG_TN_DECRYPT.toLowerCase() !== 'false'
  );
}

function debugLog(label: string, payload: unknown) {
  if (!isTnDecryptDebugEnabled()) return;
  // eslint-disable-next-line no-console
  console.log(label, payload);
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

function parseDecryptedBytesToBigInt(decrypted: unknown): bigint {
  if (!Array.isArray(decrypted)) {
    throw new CofheError({
      code: CofheErrorCode.DecryptReturnedNull,
      message: 'decrypt response field <decrypted> must be a byte array',
      context: {
        decrypted,
      },
    });
  }

  if (decrypted.length === 0) {
    throw new CofheError({
      code: CofheErrorCode.DecryptReturnedNull,
      message: 'decrypt response field <decrypted> was an empty byte array',
      context: {
        decrypted,
      },
    });
  }

  let hex = '';
  for (const b of decrypted as unknown[]) {
    if (typeof b !== 'number' || !Number.isInteger(b) || b < 0 || b > 255) {
      throw new CofheError({
        code: CofheErrorCode.DecryptReturnedNull,
        message: 'decrypt response field <decrypted> contained a non-byte value',
        context: {
          badElement: b,
          decrypted,
        },
      });
    }
    hex += b.toString(16).padStart(2, '0');
  }

  return BigInt(`0x${hex}`);
}

function assertTnDecryptResponse(value: unknown): TnDecryptResponse {
  if (value == null || typeof value !== 'object') {
    throw new CofheError({
      code: CofheErrorCode.DecryptFailed,
      message: 'decrypt response must be a JSON object',
      context: {
        value,
      },
    });
  }

  const v = value as Record<string, unknown>;
  const decrypted = v.decrypted;
  const signature = v.signature;
  const encryptionType = v.encryption_type;
  const errorMessage = v.error_message;

  if (!Array.isArray(decrypted)) {
    throw new CofheError({
      code: CofheErrorCode.DecryptReturnedNull,
      message: 'decrypt response missing <decrypted> byte array',
      context: { decryptResponse: value },
    });
  }
  if (typeof signature !== 'string') {
    throw new CofheError({
      code: CofheErrorCode.DecryptReturnedNull,
      message: 'decrypt response missing <signature> string',
      context: { decryptResponse: value },
    });
  }
  if (typeof encryptionType !== 'number') {
    throw new CofheError({
      code: CofheErrorCode.DecryptFailed,
      message: 'decrypt response missing <encryption_type> number',
      context: { decryptResponse: value },
    });
  }
  if (!(typeof errorMessage === 'string' || errorMessage === null)) {
    throw new CofheError({
      code: CofheErrorCode.DecryptFailed,
      message: 'decrypt response field <error_message> must be string or null',
      context: { decryptResponse: value },
    });
  }

  return {
    decrypted: decrypted as number[],
    signature,
    encryption_type: encryptionType,
    error_message: errorMessage,
  };
}

export async function tnDecrypt(
  ctHash: bigint,
  chainId: number,
  permission: Permission | null,
  thresholdNetworkUrl: string
): Promise<{ decryptedValue: bigint; signature: string }> {
  const url = `${thresholdNetworkUrl}/decrypt`;
  const body: {
    ct_tempkey: string;
    host_chain_id: number;
    permit?: Permission;
  } = {
    ct_tempkey: ctHash.toString(16).padStart(64, '0'),
    host_chain_id: chainId,
  };

  if (permission) {
    body.permit = permission;
  }

  debugLog('[cofhe][tnDecrypt] request', {
    url,
    body,
  });

  let response: Response;
  try {
    response = await fetch(url, {
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

  const responseText = await response.text();

  debugLog('[cofhe][tnDecrypt] response', {
    url,
    status: response.status,
    statusText: response.statusText,
    ok: response.ok,
    responseText,
  });

  // Even on non-200 responses, TN may return JSON with { error_message }.
  if (!response.ok) {
    let errorMessage = response.statusText || `HTTP ${response.status}`;
    try {
      const errorBody = JSON.parse(responseText) as Record<string, unknown>;
      const maybeMessage = (errorBody.error_message || errorBody.message) as unknown;
      if (typeof maybeMessage === 'string' && maybeMessage.length > 0) errorMessage = maybeMessage;
    } catch {
      const trimmed = responseText.trim();
      if (trimmed.length > 0) errorMessage = trimmed;
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
        responseText,
      },
    });
  }

  let rawJson: unknown;
  try {
    rawJson = JSON.parse(responseText) as unknown;
  } catch (e) {
    throw new CofheError({
      code: CofheErrorCode.DecryptFailed,
      message: `Failed to parse decrypt response`,
      cause: e instanceof Error ? e : undefined,
      context: {
        thresholdNetworkUrl,
        body,
        responseText,
      },
    });
  }

  const decryptResponse = assertTnDecryptResponse(rawJson);

  if (decryptResponse.error_message) {
    throw new CofheError({
      code: CofheErrorCode.DecryptFailed,
      message: `decrypt request failed: ${decryptResponse.error_message}`,
      context: {
        thresholdNetworkUrl,
        body,
        decryptResponse,
      },
    });
  }

  const decryptedValue = parseDecryptedBytesToBigInt(decryptResponse.decrypted);
  const signature = normalizeSignature(decryptResponse.signature);

  return { decryptedValue, signature };
}
