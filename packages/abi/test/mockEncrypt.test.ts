import { Encryptable, FheTypes } from '@cofhe/sdk';
import { generateMockCtHash, mockEncrypt, mockEncryptEncryptable } from 'src/mockEncrypt';
import { describe, expect, it } from 'vitest';
// 0xffffffffn
const UINT32_MAX = (1n << 32n) - 1n;

function uint32TruncatedStringHash(value: string): bigint {
  let hash = 0n;
  for (let index = 0; index < value.length; index++) {
    hash = (hash << 5n) - hash + BigInt(value.charCodeAt(index));
    hash = BigInt.asUintN(32, hash);
  }

  return hash;
}

describe('mockEncrypt', () => {
  it('should encrypt a boolean', () => {
    const encryptable = Encryptable.bool(true);
    const encrypted = mockEncryptEncryptable(encryptable);
    expect(encrypted).toEqual({
      ctHash: 1n,
      securityZone: 0,
      utype: FheTypes.Bool,
      signature: '0xMockSignature',
    });
  });

  it('should encrypt a uint8', () => {
    const encryptable = Encryptable.uint8(123n);
    const encrypted = mockEncryptEncryptable(encryptable);
    expect(encrypted).toEqual({
      ctHash: 123n,
      securityZone: 0,
      utype: FheTypes.Uint8,
      signature: '0xMockSignature',
    });
  });

  it('should encrypt a uint16', () => {
    const encryptable = Encryptable.uint16(1234n);
    const encrypted = mockEncryptEncryptable(encryptable);
    expect(encrypted).toEqual({
      ctHash: 1234n,
      securityZone: 0,
      utype: FheTypes.Uint16,
      signature: '0xMockSignature',
    });
  });

  it('should encrypt a uint32', () => {
    const encryptable = Encryptable.uint32(12345n);
    const encrypted = mockEncryptEncryptable(encryptable);
    expect(encrypted).toEqual({
      ctHash: 12345n,
      securityZone: 0,
      utype: FheTypes.Uint32,
      signature: '0xMockSignature',
    });
  });

  it('should encrypt a uint64', () => {
    const encryptable = Encryptable.uint64(123456n);
    const encrypted = mockEncryptEncryptable(encryptable);
    expect(encrypted).toEqual({
      ctHash: 123456n,
      securityZone: 0,
      utype: FheTypes.Uint64,
      signature: '0xMockSignature',
    });
  });

  it('should encrypt a uint128', () => {
    const encryptable = Encryptable.uint128(1234567n);
    const encrypted = mockEncryptEncryptable(encryptable);
    expect(encrypted).toEqual({
      ctHash: 1234567n,
      securityZone: 0,
      utype: FheTypes.Uint128,
      signature: '0xMockSignature',
    });
  });

  it('should encrypt a address', () => {
    const encryptableAddress = '0x1234567890abcdef';
    const encryptableAddressCtHash = generateMockCtHash(encryptableAddress);
    const encryptable = Encryptable.address(encryptableAddress);
    const encrypted = mockEncryptEncryptable(encryptable);
    expect(encrypted).toEqual({
      ctHash: encryptableAddressCtHash,
      securityZone: 0,
      utype: FheTypes.Uint160,
      signature: '0xMockSignature',
    });
  });

  it('should encrypt multiple encryptables', () => {
    const encryptableAddress = '0x1234567890abcdef';
    const encryptableAddressCtHash = generateMockCtHash(encryptableAddress);
    const encryptables = [
      Encryptable.bool(true),
      Encryptable.uint128(1234567n),
      Encryptable.address(encryptableAddress),
    ];
    const encrypted = mockEncrypt(encryptables);
    expect(encrypted).toEqual([
      {
        ctHash: 1n,
        securityZone: 0,
        utype: FheTypes.Bool,
        signature: '0xMockSignature',
      },
      {
        ctHash: 1234567n,
        securityZone: 0,
        utype: FheTypes.Uint128,
        signature: '0xMockSignature',
      },
      {
        ctHash: encryptableAddressCtHash,
        securityZone: 0,
        utype: FheTypes.Uint160,
        signature: '0xMockSignature',
      },
    ]);
  });

  it('should mask string ctHash values to 32 bits on every iteration', () => {
    const longString = '0x' + '1234567890abcdef'.repeat(32);

    expect(generateMockCtHash(longString)).toBe(uint32TruncatedStringHash(longString));
    expect(generateMockCtHash(longString)).toBeLessThanOrEqual(UINT32_MAX);
  });

  it('should use the masked string hash when encrypting string-backed inputs', () => {
    const longAddressLikeString = '0x' + 'ab'.repeat(80);
    const encryptable = Encryptable.address(longAddressLikeString);
    const encrypted = mockEncryptEncryptable(encryptable);

    expect(encrypted.ctHash).toBe(uint32TruncatedStringHash(longAddressLikeString));
    expect(encrypted.ctHash).toBeLessThanOrEqual(UINT32_MAX);
  });
});
