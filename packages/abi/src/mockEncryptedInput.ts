import {
  FheTypes,
  type EncryptableItem,
  type EncryptedAddressInput,
  type EncryptedBoolInput,
  type EncryptedItemInput,
  type EncryptedUint128Input,
  type EncryptedUint16Input,
  type EncryptedUint32Input,
  type EncryptedUint64Input,
  type EncryptedUint8Input,
} from '@cofhe/sdk';

/**
 * Generates a mock ctHash from the encryptable data.
 * This is a simple deterministic hash function for testing purposes.
 */
function generateMockCtHash(data: unknown): bigint {
  if (typeof data === 'boolean') {
    return BigInt(data ? 1 : 0);
  }
  if (typeof data === 'bigint') {
    return data;
  }
  if (typeof data === 'string') {
    // Simple hash: convert string to number and create a bigint
    let hash = 0n;
    for (let i = 0; i < data.length; i++) {
      const char = data.charCodeAt(i);
      hash = (hash << 5n) - hash + BigInt(char);
      hash = hash & hash; // Convert to 32-bit integer
    }
    return hash < 0n ? -hash : hash;
  }
  // Fallback: use a simple hash based on string representation
  return BigInt(
    Math.abs(
      JSON.stringify(data)
        .split('')
        .reduce((a, b) => {
          a = (a << 5) - a + b.charCodeAt(0);
          return a & a;
        }, 0)
    )
  );
}

/**
 * Generates a mock signature for testing purposes.
 * Returns a hex string that looks like a valid signature.
 */
function generateMockSignature(): `0x${string}` {
  // Generate a 64-character hex string (32 bytes)
  const hexChars = '0123456789abcdef';
  let signature = '0x';
  for (let i = 0; i < 64; i++) {
    signature += hexChars[Math.floor(Math.random() * hexChars.length)];
  }
  return signature as `0x${string}`;
}

/**
 * Converts an EncryptableItem to a mock EncryptedItemInput.
 * This is useful for testing and development when you don't need actual encryption.
 *
 * @param encryptable - The EncryptableItem to convert
 * @returns A mock EncryptedItemInput with the same utype and securityZone, but with mock ctHash and signature
 *
 * @example
 * const encryptable = Encryptable.uint32(100n);
 * const mockEncrypted = mockEncryptedInput(encryptable);
 * // Returns: { ctHash: 100n, securityZone: 0, utype: FheTypes.Uint32, signature: "0x..." }
 */
export function mockEncryptedInput<T extends EncryptableItem>(encryptable: T): EncryptedItemInput {
  const ctHash = generateMockCtHash(encryptable.data);
  const signature = generateMockSignature();

  // Map based on utype to return the correct specific type
  switch (encryptable.utype) {
    case FheTypes.Bool:
      return {
        ctHash,
        securityZone: 0,
        utype: FheTypes.Bool,
        signature,
      } as EncryptedBoolInput;

    case FheTypes.Uint8:
      return {
        ctHash,
        securityZone: 0,
        utype: FheTypes.Uint8,
        signature,
      } as EncryptedUint8Input;

    case FheTypes.Uint16:
      return {
        ctHash,
        securityZone: 0,
        utype: FheTypes.Uint16,
        signature,
      } as EncryptedUint16Input;

    case FheTypes.Uint32:
      return {
        ctHash,
        securityZone: 0,
        utype: FheTypes.Uint32,
        signature,
      } as EncryptedUint32Input;

    case FheTypes.Uint64:
      return {
        ctHash,
        securityZone: 0,
        utype: FheTypes.Uint64,
        signature,
      } as EncryptedUint64Input;

    case FheTypes.Uint128:
      return {
        ctHash,
        securityZone: 0,
        utype: FheTypes.Uint128,
        signature,
      } as EncryptedUint128Input;

    case FheTypes.Uint160:
      return {
        ctHash,
        securityZone: 0,
        utype: FheTypes.Uint160,
        signature,
      } as EncryptedAddressInput;

    default:
      throw new Error(`Unsupported encryptable: ${encryptable}`);
  }
}
