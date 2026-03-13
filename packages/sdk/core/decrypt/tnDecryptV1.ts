import { type Permission } from '@/permits';

import { CofheError, CofheErrorCode } from '../error';
import { normalizeTnSignature, parseDecryptedBytesToBigInt } from './tnDecryptUtils';

type TnDecryptResponseV1 = {
  // TN returns bytes in big-endian order, e.g. [0,0,0,42]
  decrypted: number[];
  signature: string;
  encryption_type: number;
  error_message: string | null;
};

function assertTnDecryptResponseV1(value: unknown): TnDecryptResponseV1 {
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

export async function tnDecryptV1(
  ctHash: bigint | string,
  chainId: number,
  permission: Permission | null,
  thresholdNetworkUrl: string
): Promise<{ decryptedValue: bigint; signature: `0x${string}` }> {
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

  const responseText = await response.text();

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

  const decryptResponse = assertTnDecryptResponseV1(rawJson);

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
  const signature = normalizeTnSignature(decryptResponse.signature);

  return { decryptedValue, signature };
}
