import { CofheError, CofheErrorCode } from '../error';
import { parseSignature, serializeSignature } from 'viem';

export function normalizeTnSignature(signature: unknown): `0x${string}` {
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

  const prefixed = trimmed.startsWith('0x') ? (trimmed as `0x${string}`) : (`0x${trimmed}` as `0x${string}`);
  // viem throws its own errors on malformed signatures; callers tell a CofheError (do not retry)
  // from a transient failure by type, so a bad signature must surface as one.
  try {
    const parsed = parseSignature(prefixed);
    return serializeSignature(parsed);
  } catch (e) {
    throw new CofheError({
      code: CofheErrorCode.DecryptReturnedNull,
      message: 'decrypt response returned a malformed signature',
      cause: e instanceof Error ? e : undefined,
      context: {
        signature,
      },
    });
  }
}

export function parseDecryptedBytesToBigInt(decrypted: unknown): bigint {
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
