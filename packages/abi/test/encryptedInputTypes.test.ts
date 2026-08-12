import { describe, it, expect } from 'vitest';
import { TestABI } from './TestABI';
import { extractEncryptableValues, insertEncryptedValues } from 'src/encryptedInputs';
import { Encryptable } from '@cofhe/sdk';

// Encrypted values are now just hashes (0x-prefixed hex), plus one shared signature appended
// after all the hashes - the same shape EncryptInputsBuilder.execute() returns.
const createHash = (ctHash: bigint): `0x${string}` => ('0x' + ctHash.toString(16).padStart(64, '0')) as `0x${string}`;
const SIGNATURE = '0xdeadbeef' as `0x${string}`;

describe('extractEncryptableValues', () => {
  it('should extract nothing from function with no encrypted inputs', () => {
    const args = [42] as const;
    const extracted = extractEncryptableValues(TestABI, 'fnNoEncryptedInputs', args);
    expect(extracted).toEqual([]);
  });

  it('should extract data from single encrypted input', () => {
    const args = [42n] as const;
    const extracted = extractEncryptableValues(TestABI, 'fnEncryptedInput', args);
    expect(extracted).toEqual([Encryptable.uint32(42n)]);
  });

  it('should extract data from blended inputs (encrypted + non-encrypted)', () => {
    const args = [500n, 200n] as const;
    const extracted = extractEncryptableValues(TestABI, 'fnBlendedInputsIncludingEncryptedInput', args);
    expect(extracted).toEqual([Encryptable.uint32(200n)]);
  });

  it('should extract data from all encrypted inputs', () => {
    const args = [1n, 2n, 3n, 4n, 5n, true, '0x1234567890123456789012345678901234567890'] as const;
    const extracted = extractEncryptableValues(TestABI, 'fnAllEncryptedInputs', args);
    expect(extracted).toEqual([
      Encryptable.uint8(1n),
      Encryptable.uint16(2n),
      Encryptable.uint32(3n),
      Encryptable.uint64(4n),
      Encryptable.uint128(5n),
      Encryptable.bool(true),
      Encryptable.address('0x1234567890123456789012345678901234567890'),
    ]);
  });

  it('should extract data from struct containing encrypted input', () => {
    const args = [
      {
        value: 1000n,
        encryptedInput: 300n,
      },
    ] as const;
    const extracted = extractEncryptableValues(TestABI, 'fnStructContainsEncryptedInput', args);
    expect(extracted).toEqual([Encryptable.uint32(300n)]);
  });

  it('should extract data from array of encrypted inputs', () => {
    const args = [[10n, 20n, 30n]] as const;
    const extracted = extractEncryptableValues(TestABI, 'fnArrayContainsEncryptedInput', args);
    expect(extracted).toEqual([Encryptable.uint32(10n), Encryptable.uint32(20n), Encryptable.uint32(30n)]);
  });

  it('should extract data from fixed-size array (tuple) of encrypted inputs', () => {
    const args = [[40n, 50n]] as const;
    const extracted = extractEncryptableValues(TestABI, 'fnTupleContainsEncryptedInput', args);
    expect(extracted).toEqual([Encryptable.uint32(40n), Encryptable.uint32(50n)]);
  });

  it('should handle string data values', () => {
    const addressValue = '0xabcdefabcdefabcdefabcdefabcdefabcdefabcd';
    const args = [1n, 2n, 3n, 4n, 5n, true, addressValue] as const;
    const extracted = extractEncryptableValues(TestABI, 'fnAllEncryptedInputs', args);
    expect(extracted[6]).toEqual(Encryptable.address(addressValue));
  });
});

describe('insertEncryptedValues', () => {
  it('should insert nothing for function with no encrypted inputs', () => {
    const originalArgs = [42] as const;
    const encryptedValues: readonly `0x${string}`[] = [];
    const result = insertEncryptedValues(TestABI, 'fnNoEncryptedInputs', originalArgs, encryptedValues);
    expect(result).toEqual([42]);
  });

  it('should insert encrypted value for single encrypted input', () => {
    const originalArgs = [100n] as const;
    const encryptedValues = [createHash(999n), SIGNATURE];
    const result = insertEncryptedValues(TestABI, 'fnEncryptedInput', originalArgs, encryptedValues);
    expect(result).toEqual([createHash(999n), SIGNATURE]);
  });

  it('should insert encrypted value for blended inputs', () => {
    const originalArgs = [500n, 200n] as const;
    const encryptedValues = [createHash(888n), SIGNATURE];
    const result = insertEncryptedValues(
      TestABI,
      'fnBlendedInputsIncludingEncryptedInput',
      originalArgs,
      encryptedValues
    );
    expect(result).toEqual([500n, createHash(888n), SIGNATURE]);
  });

  it('should insert encrypted values for all encrypted inputs', () => {
    const originalArgs = [1n, 2n, 3n, 4n, 5n, true, '0x1234567890123456789012345678901234567890'] as const;
    const encryptedValues = [
      createHash(111n),
      createHash(222n),
      createHash(333n),
      createHash(444n),
      createHash(555n),
      createHash(666n),
      createHash(777n),
      SIGNATURE,
    ];
    const result = insertEncryptedValues(TestABI, 'fnAllEncryptedInputs', originalArgs, encryptedValues);
    expect(result).toEqual(encryptedValues);
  });

  it('should insert encrypted value in struct containing encrypted input', () => {
    const originalArgs = [
      {
        value: 1000n,
        encryptedInput: 300n,
      },
    ] as const;
    const encryptedValues = [createHash(777n), SIGNATURE];
    const result = insertEncryptedValues(TestABI, 'fnStructContainsEncryptedInput', originalArgs, encryptedValues);
    expect(result).toEqual([
      {
        value: 1000n,
        encryptedInput: createHash(777n),
      },
      SIGNATURE,
    ]);
  });

  it('should insert encrypted values in array of encrypted inputs', () => {
    const originalArgs = [[10n, 20n, 30n]] as const;
    const encryptedValues = [createHash(111n), createHash(222n), createHash(333n), SIGNATURE];
    const result = insertEncryptedValues(TestABI, 'fnArrayContainsEncryptedInput', originalArgs, encryptedValues);
    expect(result).toEqual([[createHash(111n), createHash(222n), createHash(333n)], SIGNATURE]);
  });

  it('should insert encrypted values in fixed-size array (tuple) of encrypted inputs', () => {
    const originalArgs = [[40n, 50n]] as const;
    const encryptedValues = [createHash(444n), createHash(555n), SIGNATURE];
    const result = insertEncryptedValues(TestABI, 'fnTupleContainsEncryptedInput', originalArgs, encryptedValues);
    expect(result).toEqual([[createHash(444n), createHash(555n)], SIGNATURE]);
  });
});

describe('extractEncryptableValues and insertEncryptedValues round-trip', () => {
  it('should round-trip single encrypted input', () => {
    const originalArgs = [100n] as const;
    const extracted = extractEncryptableValues(TestABI, 'fnEncryptedInput', originalArgs);
    expect(extracted).toEqual([Encryptable.uint32(100n)]);
    const encrypted = [createHash(999n), SIGNATURE];
    const result = insertEncryptedValues(TestABI, 'fnEncryptedInput', originalArgs, encrypted);
    expect(result).toEqual(encrypted);
  });

  it('should round-trip blended inputs', () => {
    const originalArgs = [500n, 200n] as const;
    const extracted = extractEncryptableValues(TestABI, 'fnBlendedInputsIncludingEncryptedInput', originalArgs);
    expect(extracted).toEqual([Encryptable.uint32(200n)]);
    const encrypted = [createHash(888n), SIGNATURE];
    const result = insertEncryptedValues(TestABI, 'fnBlendedInputsIncludingEncryptedInput', originalArgs, encrypted);
    expect(result).toEqual([500n, createHash(888n), SIGNATURE]);
  });

  it('should round-trip struct containing encrypted input', () => {
    const originalArgs = [
      {
        value: 1000n,
        encryptedInput: 300n,
      },
    ] as const;
    const extracted = extractEncryptableValues(TestABI, 'fnStructContainsEncryptedInput', originalArgs);
    expect(extracted).toEqual([Encryptable.uint32(300n)]);
    const encrypted = [createHash(777n), SIGNATURE];
    const result = insertEncryptedValues(TestABI, 'fnStructContainsEncryptedInput', originalArgs, encrypted);
    expect(result).toEqual([
      {
        value: 1000n,
        encryptedInput: createHash(777n),
      },
      SIGNATURE,
    ]);
  });

  it('should round-trip array of encrypted inputs', () => {
    const originalArgs = [[10n, 20n]] as const;
    const extracted = extractEncryptableValues(TestABI, 'fnArrayContainsEncryptedInput', originalArgs);
    expect(extracted).toEqual([Encryptable.uint32(10n), Encryptable.uint32(20n)]);
    const encrypted = [createHash(111n), createHash(222n), SIGNATURE];
    const result = insertEncryptedValues(TestABI, 'fnArrayContainsEncryptedInput', originalArgs, encrypted);
    expect(result).toEqual([[createHash(111n), createHash(222n)], SIGNATURE]);
  });

  it('should handle empty array of encrypted inputs', () => {
    const originalArgs = [[]] as const;
    const extracted = extractEncryptableValues(TestABI, 'fnArrayContainsEncryptedInput', originalArgs);
    expect(extracted).toEqual([]);
    // No external inputs actually present (empty array), so no signature slot is expected either.
    const encrypted: readonly `0x${string}`[] = [];
    const result = insertEncryptedValues(TestABI, 'fnArrayContainsEncryptedInput', originalArgs, encrypted);
    expect(result).toEqual([[], undefined]);
  });
});

describe('error handling', () => {
  it('should throw error for non-existent function', () => {
    const args = [42] as const;
    expect(() => {
      extractEncryptableValues(TestABI, 'nonExistentFunction' as any, args as any);
    }).toThrow('Function nonExistentFunction not found in ABI');
  });

  it('should throw error when inserting into non-existent function', () => {
    const args = [42] as const;
    const encrypted: readonly `0x${string}`[] = [];
    expect(() => {
      insertEncryptedValues(TestABI, 'nonExistentFunction' as any, args as any, encrypted);
    }).toThrow('Function nonExistentFunction not found in ABI');
  });
});
