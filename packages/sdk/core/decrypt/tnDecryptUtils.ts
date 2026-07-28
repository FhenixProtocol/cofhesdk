import { CofheError, CofheErrorCode } from '../error';
import { parseSignature, serializeSignature } from 'viem';
import type { Permission } from '../../permits/types';

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
  const parsed = parseSignature(prefixed);
  return serializeSignature(parsed);
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

/**
 * Wire shape of an ACP as sent to the threshold network.
 *
 * Identical to `Permission` except `handles`, which the backend deserializes as
 * `Vec<String>` — and which `JSON.stringify` cannot encode as bigint anyway.
 */
export type WirePermission = Omit<Permission, 'handles'> & { handles: string[] };

/** Encode an ACP for the threshold-network HTTP API (handles as decimal strings). */
export function toWirePermission(permission: Permission): WirePermission {
  return {
    ...permission,
    // tolerate a permission that predates the scope fields — an absent list is an empty one
    handles: (permission.handles ?? []).map((h) => h.toString()),
  };
}
