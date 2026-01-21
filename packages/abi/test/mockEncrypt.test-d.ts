import {
  Encryptable,
  FheTypes,
  type EncryptedAddressInput,
  type EncryptedBoolInput,
  type EncryptedUint128Input,
  type EncryptedUint16Input,
  type EncryptedUint32Input,
  type EncryptedUint64Input,
  type EncryptedUint8Input,
} from '@cofhe/sdk';
import { mockEncrypt, mockEncryptEncryptable } from 'src/mockEncrypt';
import { assertType, describe, expect, it } from 'vitest';

describe('mockEncrypt typing', () => {
  it('should correctly type mockEncryptEncryptable for EncryptableBool', () => {
    const encryptable = Encryptable.bool(true);
    const encrypted = mockEncryptEncryptable(encryptable);
    assertType<EncryptedBoolInput>(encrypted);
  });
  it('should correctly type mockEncryptEncryptable for EncryptableUint8', () => {
    const encryptable = Encryptable.uint8(123n);
    const encrypted = mockEncryptEncryptable(encryptable);
    assertType<EncryptedUint8Input>(encrypted);
  });
  it('should correctly type mockEncryptEncryptable for EncryptableUint16', () => {
    const encryptable = Encryptable.uint16(1234n);
    const encrypted = mockEncryptEncryptable(encryptable);
    assertType<EncryptedUint16Input>(encrypted);
  });
  it('should correctly type mockEncryptEncryptable for EncryptableUint32', () => {
    const encryptable = Encryptable.uint32(12345n);
    const encrypted = mockEncryptEncryptable(encryptable);
    assertType<EncryptedUint32Input>(encrypted);
  });
  it('should correctly type mockEncryptEncryptable for EncryptableUint64', () => {
    const encryptable = Encryptable.uint64(123456n);
    const encrypted = mockEncryptEncryptable(encryptable);
    assertType<EncryptedUint64Input>(encrypted);
  });
  it('should correctly type mockEncryptEncryptable for EncryptableUint128', () => {
    const encryptable = Encryptable.uint128(1234567n);
    const encrypted = mockEncryptEncryptable(encryptable);
    assertType<EncryptedUint128Input>(encrypted);
  });
  it('should correctly type mockEncryptEncryptable for EncryptableAddress', () => {
    const encryptable = Encryptable.address('0x1234567890abcdef');
    const encrypted = mockEncryptEncryptable(encryptable);
    assertType<EncryptedAddressInput>(encrypted);
  });
  
  it('should correctly type mockEncrypt for [EncryptableBool, EncryptableUint8, EncryptableUint16, EncryptableUint32, EncryptableUint64, EncryptableUint128, EncryptableAddress]', () => {
    const encryptables = [
      Encryptable.bool(true),
      Encryptable.uint8(123n),
      Encryptable.uint16(1234n),
      Encryptable.uint32(12345n),
      Encryptable.uint64(123456n),
      Encryptable.uint128(1234567n),
      Encryptable.address('0x1234567890abcdef'),
    ] as const;
    const encrypted = mockEncrypt(encryptables);
    assertType<
      [
        EncryptedBoolInput,
        EncryptedUint8Input,
        EncryptedUint16Input,
        EncryptedUint32Input,
        EncryptedUint64Input,
        EncryptedUint128Input,
        EncryptedAddressInput,
      ]
    >(encrypted);
  });
});
