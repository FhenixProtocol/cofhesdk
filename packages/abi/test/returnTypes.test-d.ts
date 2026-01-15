import { assertType, test } from 'vitest';
import { TestABI } from './TestABI';
import type { CofheReturnType, CofheReturnTypePostTransform } from 'src/encryptedReturnTypes';
import { FheTypes } from '@cofhe/sdk';
import type { EUint8, EUint16, EUint32, EUint64, EUint128, EBool, EAddress } from 'src/fhenixMap';

const euint8: EUint8 = {
  ctHash: 1n,
  utype: FheTypes.Uint8,
};

const euint16: EUint16 = {
  ctHash: 1n,
  utype: FheTypes.Uint16,
};

const euint32: EUint32 = {
  ctHash: 1n,
  utype: FheTypes.Uint32,
};

const euint64: EUint64 = {
  ctHash: 1n,
  utype: FheTypes.Uint64,
};

const euint128: EUint128 = {
  ctHash: 1n,
  utype: FheTypes.Uint128,
};

const ebool: EBool = {
  ctHash: 1n,
  utype: FheTypes.Bool,
};

const eaddress: EAddress = {
  ctHash: 1n,
  utype: FheTypes.Uint160,
};

test('fnReturnNoEncrypted should have return type uint256', () => {
  type args = CofheReturnType<typeof TestABI, 'fnReturnNoEncrypted'>;
  assertType<args>(1n);

  type postTransform = CofheReturnTypePostTransform<typeof TestABI, 'fnReturnNoEncrypted'>;
  assertType<postTransform>(1n);
});

test('fnReturnEncrypted should have return type euint32', () => {
  type args = CofheReturnType<typeof TestABI, 'fnReturnEncrypted'>;
  assertType<args>(euint32);

  type postTransform = CofheReturnTypePostTransform<typeof TestABI, 'fnReturnEncrypted'>;
  assertType<postTransform>(1n);
});

test('fnReturnBlendedIncludingEncrypted should have return type (uint256, euint32)', () => {
  type args = CofheReturnType<typeof TestABI, 'fnReturnBlendedIncludingEncrypted'>;
  assertType<args>([1n, euint32]);

  type postTransform = CofheReturnTypePostTransform<typeof TestABI, 'fnReturnBlendedIncludingEncrypted'>;
  assertType<postTransform>([1n, 1n]);
});

test('fnReturnEncryptedArray should have return type euint32[]', () => {
  type args = CofheReturnType<typeof TestABI, 'fnReturnEncryptedArray'>;
  assertType<args>([euint32]);

  type postTransform = CofheReturnTypePostTransform<typeof TestABI, 'fnReturnEncryptedArray'>;
  assertType<postTransform>([1n]);
});

test('fnReturnEncryptedStruct should have return type ContainsEncryptedResult', () => {
  type args = CofheReturnType<typeof TestABI, 'fnReturnEncryptedStruct'>;
  assertType<args>({ value: 1n, encryptedResult: euint32 });

  type postTransform = CofheReturnTypePostTransform<typeof TestABI, 'fnReturnEncryptedStruct'>;
  assertType<postTransform>({ value: 1n, encryptedResult: 1n });
});

test('fnReturnAllEncrypted should have return type (euint8, euint16, euint32, euint64, euint128, ebool, eaddress)', () => {
  type args = CofheReturnType<typeof TestABI, 'fnReturnAllEncrypted'>;
  assertType<args>([euint8, euint16, euint32, euint64, euint128, ebool, eaddress]);

  type postTransform = CofheReturnTypePostTransform<typeof TestABI, 'fnReturnAllEncrypted'>;
  assertType<postTransform>([1n, 1n, 1n, 1n, 1n, true, '0x1234567890abcdef']);
});
