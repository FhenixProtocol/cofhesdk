import { describe, it, expect } from 'vitest';
import { TestABI } from './TestABI';
import { extractEncryptableValues, insertEncryptedValues } from 'src/encryptedInputs';
import {
  Encryptable,
  FheTypes,
  type EncryptedAddressInput,
  type EncryptedBoolInput,
  type EncryptedItemInput,
  type EncryptedUint128Input,
  type EncryptedUint16Input,
  type EncryptedUint32Input,
  type EncryptedUint64Input,
  type EncryptedUint8Input,
} from '@cofhe/sdk';

// Helper to create encrypted input objects
const createEncryptedUint8 = (ctHash: bigint): EncryptedUint8Input => ({
  ctHash,
  securityZone: 0,
  utype: FheTypes.Uint8,
  signature: '0x1234567890abcdef',
});

const createEncryptedUint16 = (ctHash: bigint): EncryptedUint16Input => ({
  ctHash,
  securityZone: 0,
  utype: FheTypes.Uint16,
  signature: '0x1234567890abcdef',
});

const createEncryptedUint32 = (ctHash: bigint): EncryptedUint32Input => ({
  ctHash,
  securityZone: 0,
  utype: FheTypes.Uint32,
  signature: '0x1234567890abcdef',
});

const createEncryptedUint64 = (ctHash: bigint): EncryptedUint64Input => ({
  ctHash,
  securityZone: 0,
  utype: FheTypes.Uint64,
  signature: '0x1234567890abcdef',
});

const createEncryptedUint128 = (ctHash: bigint): EncryptedUint128Input => ({
  ctHash,
  securityZone: 0,
  utype: FheTypes.Uint128,
  signature: '0x1234567890abcdef',
});

const createEncryptedBool = (ctHash: bigint): EncryptedBoolInput => ({
  ctHash,
  securityZone: 0,
  utype: FheTypes.Bool,
  signature: '0x1234567890abcdef',
});

const createEncryptedAddress = (ctHash: bigint): EncryptedAddressInput => ({
  ctHash,
  securityZone: 0,
  utype: FheTypes.Uint160,
  signature: '0x1234567890abcdef',
});

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
    const encryptedValues: EncryptedItemInput[] = [];
    const result = insertEncryptedValues(TestABI, 'fnNoEncryptedInputs', originalArgs, encryptedValues);
    expect(result).toEqual([42]);
  });

  it('should insert encrypted value for single encrypted input', () => {
    const originalArgs = [100n] as const;
    const encryptedValues = [createEncryptedUint32(999n)];
    const result = insertEncryptedValues(TestABI, 'fnEncryptedInput', originalArgs, encryptedValues);
    expect(result).toEqual([createEncryptedUint32(999n)]);
  });

  it('should insert encrypted value for blended inputs', () => {
    const originalArgs = [500n, 200n] as const;
    const encryptedValues = [createEncryptedUint32(888n)];
    const result = insertEncryptedValues(
      TestABI,
      'fnBlendedInputsIncludingEncryptedInput',
      originalArgs,
      encryptedValues
    );
    expect(result).toEqual([500n, createEncryptedUint32(888n)]);
  });

  it('should insert encrypted values for all encrypted inputs', () => {
    const originalArgs = [1n, 2n, 3n, 4n, 5n, true, '0x1234567890123456789012345678901234567890'] as const;
    const encryptedValues = [
      createEncryptedUint8(111n),
      createEncryptedUint16(222n),
      createEncryptedUint32(333n),
      createEncryptedUint64(444n),
      createEncryptedUint128(555n),
      createEncryptedBool(666n),
      createEncryptedAddress(777n),
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
    const encryptedValues = [createEncryptedUint32(777n)];
    const result = insertEncryptedValues(TestABI, 'fnStructContainsEncryptedInput', originalArgs, encryptedValues);
    expect(result).toEqual([
      {
        value: 1000n,
        encryptedInput: createEncryptedUint32(777n),
      },
    ]);
  });

  it('should insert encrypted values in array of encrypted inputs', () => {
    const originalArgs = [[10n, 20n, 30n]] as const;
    const encryptedValues = [createEncryptedUint32(111n), createEncryptedUint32(222n), createEncryptedUint32(333n)];
    const result = insertEncryptedValues(TestABI, 'fnArrayContainsEncryptedInput', originalArgs, encryptedValues);
    expect(result).toEqual([[createEncryptedUint32(111n), createEncryptedUint32(222n), createEncryptedUint32(333n)]]);
  });

  it('should insert encrypted values in fixed-size array (tuple) of encrypted inputs', () => {
    const originalArgs = [[40n, 50n]] as const;
    const encryptedValues = [createEncryptedUint32(444n), createEncryptedUint32(555n)];
    const result = insertEncryptedValues(TestABI, 'fnTupleContainsEncryptedInput', originalArgs, encryptedValues);
    expect(result).toEqual([[createEncryptedUint32(444n), createEncryptedUint32(555n)]]);
  });
});

describe('extractEncryptableValues and insertEncryptedValues round-trip', () => {
  it('should round-trip single encrypted input', () => {
    const originalArgs = [100n] as const;
    const extracted = extractEncryptableValues(TestABI, 'fnEncryptedInput', originalArgs);
    expect(extracted).toEqual([Encryptable.uint32(100n)]);
    const encrypted = [createEncryptedUint32(999n)];
    const result = insertEncryptedValues(TestABI, 'fnEncryptedInput', originalArgs, encrypted);
    expect(result).toEqual(encrypted);
  });

  it('should round-trip blended inputs', () => {
    const originalArgs = [500n, 200n] as const;
    const extracted = extractEncryptableValues(TestABI, 'fnBlendedInputsIncludingEncryptedInput', originalArgs);
    expect(extracted).toEqual([Encryptable.uint32(200n)]);
    const encrypted = [createEncryptedUint32(888n)];
    const result = insertEncryptedValues(TestABI, 'fnBlendedInputsIncludingEncryptedInput', originalArgs, encrypted);
    expect(result).toEqual([500n, createEncryptedUint32(888n)]);
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
    const encrypted = [createEncryptedUint32(777n)];
    const result = insertEncryptedValues(TestABI, 'fnStructContainsEncryptedInput', originalArgs, encrypted);
    expect(result).toEqual([
      {
        value: 1000n,
        encryptedInput: createEncryptedUint32(777n),
      },
    ]);
  });

  it('should round-trip array of encrypted inputs', () => {
    const originalArgs = [[10n, 20n]] as const;
    const extracted = extractEncryptableValues(TestABI, 'fnArrayContainsEncryptedInput', originalArgs);
    expect(extracted).toEqual([Encryptable.uint32(10n), Encryptable.uint32(20n)]);
    const encrypted = [createEncryptedUint32(111n), createEncryptedUint32(222n)];
    const result = insertEncryptedValues(TestABI, 'fnArrayContainsEncryptedInput', originalArgs, encrypted);
    expect(result).toEqual([[createEncryptedUint32(111n), createEncryptedUint32(222n)]]);
  });

  it('should handle empty array of encrypted inputs', () => {
    const originalArgs = [[]] as const;
    const extracted = extractEncryptableValues(TestABI, 'fnArrayContainsEncryptedInput', originalArgs);
    expect(extracted).toEqual([]);
    const encrypted: EncryptedItemInput[] = [];
    const result = insertEncryptedValues(TestABI, 'fnArrayContainsEncryptedInput', originalArgs, encrypted);
    expect(result).toEqual([[]]);
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
    const encrypted: EncryptedItemInput[] = [];
    expect(() => {
      insertEncryptedValues(TestABI, 'nonExistentFunction' as any, args as any, encrypted);
    }).toThrow('Function nonExistentFunction not found in ABI');
  });
});
