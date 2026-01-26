import { transformEncryptedReturnTypes } from 'src/encryptedReturnTypes';
import { describe, it, expect } from 'vitest';
import { TestABI } from './TestABI';
import { FheTypes } from '@cofhe/sdk';

describe('transformEncryptedReturnTypes', () => {
  it('should not transform non-encrypted return type', () => {
    const result = transformEncryptedReturnTypes(TestABI, 'fnReturnNoEncrypted', 1n);
    expect(result).toEqual(1n);
  });
  it('should transform single encrypted return type', () => {
    const result = transformEncryptedReturnTypes(TestABI, 'fnReturnEncrypted', 1n);
    expect(result).toEqual({
      ctHash: 1n,
      utype: FheTypes.Uint32,
    });
  });
  it('should transform blended return type', () => {
    const result = transformEncryptedReturnTypes(TestABI, 'fnReturnBlendedIncludingEncrypted', [1n, 2n]);
    expect(result).toEqual([
      1n,
      {
        ctHash: 2n,
        utype: FheTypes.Uint32,
      },
    ]);
  });
  it('should transform encrypted array return type', () => {
    const result = transformEncryptedReturnTypes(TestABI, 'fnReturnEncryptedArray', [1n, 2n]);
    expect(result).toEqual([
      {
        ctHash: 1n,
        utype: FheTypes.Uint32,
      },
      {
        ctHash: 2n,
        utype: FheTypes.Uint32,
      },
    ]);
  });
  it('should transform encrypted struct return type', () => {
    const result = transformEncryptedReturnTypes(TestABI, 'fnReturnEncryptedStruct', {
      value: 1n,
      encryptedResult: 2n,
    });
    expect(result).toEqual({
      value: 1n,
      encryptedResult: {
        ctHash: 2n,
        utype: FheTypes.Uint32,
      },
    });
  });
  it('should transform all encrypted return types', () => {
    const result = transformEncryptedReturnTypes(TestABI, 'fnReturnAllEncrypted', [1n, 2n, 3n, 4n, 5n, 6n, 7n]);
    expect(result).toEqual([
      {
        ctHash: 1n,
        utype: FheTypes.Uint8,
      },
      {
        ctHash: 2n,
        utype: FheTypes.Uint16,
      },
      {
        ctHash: 3n,
        utype: FheTypes.Uint32,
      },
      {
        ctHash: 4n,
        utype: FheTypes.Uint64,
      },
      {
        ctHash: 5n,
        utype: FheTypes.Uint128,
      },
      {
        ctHash: 6n,
        utype: FheTypes.Bool,
      },
      {
        ctHash: 7n,
        utype: FheTypes.Uint160,
      },
    ]);
  });
});
