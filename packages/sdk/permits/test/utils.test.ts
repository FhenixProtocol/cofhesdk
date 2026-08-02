import { describe, it, expect } from 'vitest';
import { fromHexString, toBeArray, toHexString } from '../utils.js';
import { CofheError, CofheErrorCode } from '../../core/error.js';

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

  it('round-trips a 32-byte sealing key through toHexString', () => {
    const privateKey = 'a3'.repeat(32);

    const bytes = fromHexString(privateKey);

    expect(bytes.length).toBe(32);
    expect(toHexString(bytes)).toBe(privateKey);
  });

  it('throws instead of silently producing zero bytes for non-hex characters', () => {
    expect(() => fromHexString('zzzz')).toThrow(CofheError);
  });

  it('throws for hex strings with a single invalid character', () => {
    expect(() => fromHexString('0x12g4')).toThrow(CofheError);
  });

  it('reports the invalid hex with a stable error code and without leaking the value', () => {
    const secret = 'f'.repeat(63) + 'z';

    try {
      fromHexString(secret);
      expect.unreachable('fromHexString should have thrown');
    } catch (error) {
      expect(error).toBeInstanceOf(CofheError);
      const cofheError = error as CofheError;
      expect(cofheError.code).toBe(CofheErrorCode.InvalidPermitData);
      expect(cofheError.message).not.toContain(secret);
      expect(cofheError.context).toEqual({ length: secret.length });
    }
  });
});

describe('toBeArray', () => {
  it('still encodes values that need an odd-length hex representation', () => {
    expect(Array.from(toBeArray(0x123))).toEqual([0x01, 0x23]);
    expect(Array.from(toBeArray(255n))).toEqual([0xff]);
  });
});
