import {
  Encryptable,
  type ExternalAddressHash,
  type ExternalBoolHash,
  type ExternalHashProof,
  type ExternalUint128Hash,
  type ExternalUint16Hash,
  type ExternalUint32Hash,
  type ExternalUint64Hash,
  type ExternalUint8Hash,
} from '@cofhe/sdk';
import { mockEncrypt, mockEncryptEncryptable } from 'src/mockEncrypt';
import { assertType, describe, expect, it } from 'vitest';

describe('mockEncrypt typing', () => {
  it('should correctly type mockEncryptEncryptable for EncryptableBool', () => {
    const encryptable = Encryptable.bool(true);
    const encrypted = mockEncryptEncryptable(encryptable);
    assertType<ExternalBoolHash>(encrypted);
  });
  it('should correctly type mockEncryptEncryptable for EncryptableUint8', () => {
    const encryptable = Encryptable.uint8(123n);
    const encrypted = mockEncryptEncryptable(encryptable);
    assertType<ExternalUint8Hash>(encrypted);
  });
  it('should correctly type mockEncryptEncryptable for EncryptableUint16', () => {
    const encryptable = Encryptable.uint16(1234n);
    const encrypted = mockEncryptEncryptable(encryptable);
    assertType<ExternalUint16Hash>(encrypted);
  });
  it('should correctly type mockEncryptEncryptable for EncryptableUint32', () => {
    const encryptable = Encryptable.uint32(12345n);
    const encrypted = mockEncryptEncryptable(encryptable);
    assertType<ExternalUint32Hash>(encrypted);
  });
  it('should correctly type mockEncryptEncryptable for EncryptableUint64', () => {
    const encryptable = Encryptable.uint64(123456n);
    const encrypted = mockEncryptEncryptable(encryptable);
    assertType<ExternalUint64Hash>(encrypted);
  });
  it('should correctly type mockEncryptEncryptable for EncryptableUint128', () => {
    const encryptable = Encryptable.uint128(1234567n);
    const encrypted = mockEncryptEncryptable(encryptable);
    assertType<ExternalUint128Hash>(encrypted);
  });
  it('should correctly type mockEncryptEncryptable for EncryptableAddress', () => {
    const encryptable = Encryptable.address('0x1234567890abcdef');
    const encrypted = mockEncryptEncryptable(encryptable);
    assertType<ExternalAddressHash>(encrypted);
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
    // Per-item hashes in order, followed by one shared batch signature.
    assertType<
      [
        ExternalBoolHash,
        ExternalUint8Hash,
        ExternalUint16Hash,
        ExternalUint32Hash,
        ExternalUint64Hash,
        ExternalUint128Hash,
        ExternalAddressHash,
        ExternalHashProof,
      ]
    >(encrypted);
  });
});
