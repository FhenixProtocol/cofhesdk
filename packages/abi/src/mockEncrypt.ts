import {
  FheTypes,
  type EncryptableItem,
  type EncryptableToEncryptedItemInputMap,
  type EncryptedAddressInput,
  type EncryptedBoolInput,
  type EncryptedItemInput,
  type EncryptedItemInputs,
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
export function generateMockCtHash(data: unknown): bigint {
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
  return '0xMockSignature';
}

export function mockEncryptEncryptable<T extends EncryptableItem>(encryptable: T): EncryptedItemInputs<T> {
  const ctHash = generateMockCtHash(encryptable.data);
  const signature = generateMockSignature();

  return {
    ctHash,
    securityZone: 0,
    utype: encryptable.utype,
    signature,
  } as EncryptedItemInputs<T>;
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
export function mockEncrypt<T extends EncryptableItem[]>(
  encryptables: [...T] | readonly [...T]
): [...EncryptedItemInputs<T>] {
  return encryptables.map(mockEncryptEncryptable) as [...EncryptedItemInputs<[...T]>];
}
