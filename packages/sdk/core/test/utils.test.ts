import { describe, it, expect } from 'vitest';
import {
  fromHexString,
  toHexString,
  hexToBytes,
  toBigIntOrThrow,
  validateBigIntInRange,
  fheTypeToString,
} from '../utils.js';
import { FheTypes } from '../types.js';

describe('fromHexString', () => {
  it('strips the 0x prefix before padding an odd-length string', () => {
    // Regression: padding first produced `00x123`, which decoded to [0x00, NaN->0, 0x23].
    expect(Array.from(fromHexString('0x123'))).toEqual([0x01, 0x23]);
  });

  it('pads odd-length strings without a prefix', () => {
    expect(Array.from(fromHexString('123'))).toEqual([0x01, 0x23]);
  });

  it('decodes even-length strings with and without the 0x prefix identically', () => {
    expect(Array.from(fromHexString('0x1234'))).toEqual([0x12, 0x34]);
    expect(Array.from(fromHexString('1234'))).toEqual([0x12, 0x34]);
  });

  it('decodes uppercase hex', () => {
    expect(Array.from(fromHexString('0xDEADBEEF'))).toEqual([0xde, 0xad, 0xbe, 0xef]);
  });

  it('returns an empty array for empty input', () => {
    expect(fromHexString('')).toEqual(new Uint8Array());
    expect(fromHexString('0x')).toEqual(new Uint8Array());
  });

  it('round-trips through toHexString', () => {
    const hex = 'a3'.repeat(32);
    const bytes = fromHexString(hex);

    expect(bytes.length).toBe(32);
    expect(toHexString(bytes)).toBe(hex);
  });

  it('throws instead of silently producing zero bytes for non-hex characters', () => {
    expect(() => fromHexString('zzzz')).toThrow('Invalid hex string');
  });

  it('throws for hex strings with a single invalid character', () => {
    expect(() => fromHexString('0x12g4')).toThrow('Invalid hex string');
  });

  it('only strips a lowercase 0x prefix', () => {
    expect(() => fromHexString('0X12')).toThrow('Invalid hex string');
  });

  it('does not leak sensitive input in the error message', () => {
    const secret = 'f'.repeat(63) + 'z';

    expect(() => fromHexString(secret)).toThrow(
      expect.objectContaining({ message: expect.not.stringContaining(secret) })
    );
  });
});

describe('hexToBytes', () => {
  it('decodes even-length hex with and without prefix', () => {
    expect(Array.from(hexToBytes('0x1234'))).toEqual([0x12, 0x34]);
    expect(Array.from(hexToBytes('1234'))).toEqual([0x12, 0x34]);
  });

  it('handles odd-length hex correctly with prefix', () => {
    expect(Array.from(hexToBytes('0x123'))).toEqual([0x01, 0x23]);
    expect(Array.from(hexToBytes('123'))).toEqual([0x01, 0x23]);
  });

  it('throws for invalid hex characters', () => {
    expect(() => hexToBytes('0x12z4')).toThrow('Invalid hex string');
  });
});

describe('toHexString', () => {
  it('pads each byte to 2 hex characters', () => {
    const bytes = new Uint8Array([0x00, 0x0f, 0x10, 0xff]);
    expect(toHexString(bytes)).toBe('000f10ff');
  });
});

describe('toBigIntOrThrow', () => {
  it('returns bigint unchanged if passed bigint', () => {
    expect(toBigIntOrThrow(123n)).toBe(123n);
  });

  it('converts valid string to bigint', () => {
    expect(toBigIntOrThrow('456')).toBe(456n);
    expect(toBigIntOrThrow('0x10')).toBe(16n);
  });

  it('throws for invalid string', () => {
    expect(() => toBigIntOrThrow('not-a-number')).toThrow('Invalid input: Unable to convert to bigint');
  });

  it('throws for empty and blank strings instead of returning 0', () => {
    expect(() => toBigIntOrThrow('')).toThrow('Invalid input: Unable to convert to bigint');
    expect(() => toBigIntOrThrow('   ')).toThrow('Invalid input: Unable to convert to bigint');
  });
});

describe('validateBigIntInRange', () => {
  it('accepts values within range', () => {
    expect(() => validateBigIntInRange(10n, 20n, 0n)).not.toThrow();
  });

  it('throws when value exceeds max', () => {
    expect(() => validateBigIntInRange(25n, 20n, 0n)).toThrow('Value out of range');
  });

  it('throws when value is below min', () => {
    expect(() => validateBigIntInRange(5n, 20n, 10n)).toThrow('Value out of range');
  });
});

describe('fheTypeToString', () => {
  it('maps known types to string identifiers', () => {
    expect(fheTypeToString(FheTypes.Bool)).toBe('bool');
    expect(fheTypeToString(FheTypes.Uint8)).toBe('uint8');
    expect(fheTypeToString(FheTypes.Uint16)).toBe('uint16');
    expect(fheTypeToString(FheTypes.Uint32)).toBe('uint32');
    expect(fheTypeToString(FheTypes.Uint64)).toBe('uint64');
    expect(fheTypeToString(FheTypes.Uint128)).toBe('uint128');
    expect(fheTypeToString(FheTypes.Uint160)).toBe('uint160');
    expect(fheTypeToString(FheTypes.Uint256)).toBe('uint256');
  });
});
