import { assertType, test } from 'vitest';
import { TestABI } from './TestABI';
import type { CofheInputArgs, CofheInputArgsPreTransform } from 'src/encryptedInputs';
import {
  FheTypes,
  type EncryptedAddressInput,
  type EncryptedBoolInput,
  type EncryptedUint128Input,
  type EncryptedUint16Input,
  type EncryptedUint32Input,
  type EncryptedUint64Input,
  type EncryptedUint8Input,
} from '@cofhe/sdk';
import type { MaybeExtractArrayParameterType } from 'src/utils';

const inEuint8: EncryptedUint8Input = {
  ctHash: 1n,
  securityZone: 0,
  utype: FheTypes.Uint8,
  signature: '0x1234567890abcdef',
};

const inEuint16: EncryptedUint16Input = {
  ctHash: 1n,
  securityZone: 0,
  utype: FheTypes.Uint16,
  signature: '0x1234567890abcdef',
};

const inEuint32: EncryptedUint32Input = {
  ctHash: 1n,
  securityZone: 0,
  utype: FheTypes.Uint32,
  signature: '0x1234567890abcdef',
};

const inEuint64: EncryptedUint64Input = {
  ctHash: 1n,
  securityZone: 0,
  utype: FheTypes.Uint64,
  signature: '0x1234567890abcdef',
};

const inEuint128: EncryptedUint128Input = {
  ctHash: 1n,
  securityZone: 0,
  utype: FheTypes.Uint128,
  signature: '0x1234567890abcdef',
};

const inEbool: EncryptedBoolInput = {
  ctHash: 1n,
  securityZone: 0,
  utype: FheTypes.Bool,
  signature: '0x1234567890abcdef',
};

const inEaddress: EncryptedAddressInput = {
  ctHash: 1n,
  securityZone: 0,
  utype: FheTypes.Uint160,
  signature: '0x1234567890abcdef',
};

test('fnNoEncryptedInputs should have parameter type uint8', () => {
  assertType<CofheInputArgs<typeof TestABI, 'fnNoEncryptedInputs'>>([1]);
  assertType<CofheInputArgsPreTransform<typeof TestABI, 'fnNoEncryptedInputs'>>([1]);
});

test('fnEncryptedInput should have parameter type InEuint32', () => {
  type args = CofheInputArgs<typeof TestABI, 'fnEncryptedInput'>;
  assertType<args>([inEuint32]);

  type preTransform = CofheInputArgsPreTransform<typeof TestABI, 'fnEncryptedInput'>;
  assertType<preTransform>([1n]);
});

test('fnBlendedInputsIncludingEncryptedInput should have parameter type uint256 and InEuint32', () => {
  type args = CofheInputArgs<typeof TestABI, 'fnBlendedInputsIncludingEncryptedInput'>;
  assertType<args>([1n, inEuint32]);

  type preTransform = CofheInputArgsPreTransform<typeof TestABI, 'fnBlendedInputsIncludingEncryptedInput'>;
  assertType<preTransform>([1n, 1n]);
});

test('fnAllEncryptedInputs should have parameter type InEuint8, InEuint16, InEuint32, InEuint64, InEuint128, InEuint256, InEbool, InEaddress', () => {
  type args = CofheInputArgs<typeof TestABI, 'fnAllEncryptedInputs'>;
  assertType<args>([inEuint8, inEuint16, inEuint32, inEuint64, inEuint128, inEbool, inEaddress]);

  type preTransform = CofheInputArgsPreTransform<typeof TestABI, 'fnAllEncryptedInputs'>;
  assertType<preTransform>([1n, 1n, 1n, 1n, 1n, true, '0x1234567890abcdef']);
});

test('fnStructContainsEncryptedInput should have parameter type ContainsEncryptedInput', () => {
  type args = CofheInputArgs<typeof TestABI, 'fnStructContainsEncryptedInput'>;
  assertType<args>([{ value: 1n, encryptedInput: inEuint32 }]);

  type preTransform = CofheInputArgsPreTransform<typeof TestABI, 'fnStructContainsEncryptedInput'>;
  assertType<preTransform>([{ value: 1n, encryptedInput: 1n }]);
});

test('fnArrayContainsEncryptedInput should have parameter type InEuint32[]', () => {
  type args = CofheInputArgs<typeof TestABI, 'fnArrayContainsEncryptedInput'>;
  assertType<args>([[inEuint32]]);

  type preTransform = CofheInputArgsPreTransform<typeof TestABI, 'fnArrayContainsEncryptedInput'>;
  assertType<preTransform>([[1n]]);
});

test('fnTupleContainsEncryptedInput should have parameter type InEuint32[2]', () => {
  type args = CofheInputArgs<typeof TestABI, 'fnTupleContainsEncryptedInput'>;
  assertType<args>([[inEuint32, inEuint32]]);

  type preTransform = CofheInputArgsPreTransform<typeof TestABI, 'fnTupleContainsEncryptedInput'>;
  assertType<preTransform>([[1n, 1n]]);
});

test('extractArrayParameterType should return [InEuint32, 2]', () => {
  type test = MaybeExtractArrayParameterType<'struct InEuint32[2]'>;
  assertType<test>(['struct InEuint32', '2']);

  type test2 = MaybeExtractArrayParameterType<'struct InEuint32[]'>;
  assertType<test2>(['struct InEuint32', '']);
});
