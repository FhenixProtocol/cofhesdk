import { type EncryptableItem, type EncryptableToExternalHashMap, type HashPlusProofResult } from '@cofhe/sdk';

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
    // Keep only the low 32 bits after each round so the accumulator stays in
    // the uint32 range instead of growing as an unbounded bigint.
    let hash = 0n;
    for (let i = 0; i < data.length; i++) {
      const char = data.charCodeAt(i);
      hash = (hash << 5n) - hash + BigInt(char);
      hash = BigInt.asUintN(32, hash);
    }
    return hash;
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
 * Generates a mock batch signature for testing purposes.
 * Returns a hex string that looks like a valid signature.
 */
function generateMockSignature(): `0x${string}` {
  return '0xMockSignature';
}

/**
 * Converts an EncryptableItem to its mock external hash, without any real encryption or signing.
 *
 * @param encryptable - The EncryptableItem to convert
 * @returns A mock hash (branded by utype), deterministically derived from the encryptable's data
 */
export function mockEncryptEncryptable<T extends EncryptableItem>(encryptable: T): EncryptableToExternalHashMap<T> {
  const ctHash = generateMockCtHash(encryptable.data);
  return ('0x' + ctHash.toString(16).padStart(64, '0')) as EncryptableToExternalHashMap<T>;
}

/**
 * Converts an array of EncryptableItems into a mock batch-verified result: per-item hashes
 * followed by a single mock batch signature - the same shape `EncryptInputsBuilder.execute()`
 * returns. Useful for testing and development when you don't need actual encryption.
 *
 * @example
 * const mockEncrypted = mockEncrypt([Encryptable.uint32(100n)]);
 * // Returns: [hash, "0xMockSignature"]
 */
export function mockEncrypt<T extends EncryptableItem[]>(
  encryptables: [...T] | readonly [...T]
): HashPlusProofResult<T> {
  const hashes = encryptables.map(mockEncryptEncryptable);
  const signature = generateMockSignature();
  return [...hashes, signature] as unknown as HashPlusProofResult<T>;
}
