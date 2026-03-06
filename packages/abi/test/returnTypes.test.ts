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
    const result = transformEncryptedReturnTypes(TestABI, 'fnReturnEncrypted', '0x1');
    expect(result).toEqual({
      ctHash: '0x1',
      utype: FheTypes.Uint32,
    });
  });
  it('should transform blended return type', () => {
    const result = transformEncryptedReturnTypes(TestABI, 'fnReturnBlendedIncludingEncrypted', [1n, '0x2']);
    expect(result).toEqual([
      1n,
      {
        ctHash: '0x2',
        utype: FheTypes.Uint32,
      },
    ]);
  });
  it('should transform encrypted array return type', () => {
    const result = transformEncryptedReturnTypes(TestABI, 'fnReturnEncryptedArray', ['0x1', '0x2']);
    expect(result).toEqual([
      {
        ctHash: '0x1',
        utype: FheTypes.Uint32,
      },
      {
        ctHash: '0x2',
        utype: FheTypes.Uint32,
      },
    ]);
  });
  it('should transform encrypted struct return type', () => {
    const result = transformEncryptedReturnTypes(TestABI, 'fnReturnEncryptedStruct', {
      value: 1n,
      encryptedResult: '0x2',
    });
    expect(result).toEqual({
      value: 1n,
      encryptedResult: {
        ctHash: '0x2',
        utype: FheTypes.Uint32,
      },
    });
  });
  it('should transform all encrypted return types', () => {
    const result = transformEncryptedReturnTypes(TestABI, 'fnReturnAllEncrypted', [
      '0x1',
      '0x2',
      '0x3',
      '0x4',
      '0x5',
      '0x6',
      '0x7',
    ]);
    expect(result).toEqual([
      {
        ctHash: '0x1',
        utype: FheTypes.Uint8,
      },
      {
        ctHash: '0x2',
        utype: FheTypes.Uint16,
      },
      {
        ctHash: '0x3',
        utype: FheTypes.Uint32,
      },
      {
        ctHash: '0x4',
        utype: FheTypes.Uint64,
      },
      {
        ctHash: '0x5',
        utype: FheTypes.Uint128,
      },
      {
        ctHash: '0x6',
        utype: FheTypes.Bool,
      },
      {
        ctHash: '0x7',
        utype: FheTypes.Uint160,
      },
    ]);
  });
});
