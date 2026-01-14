import { assertType, test } from 'vitest';
import { TestABI } from './TestABI';
import type {
  CofheInputArgs,
  CofheInputArgsPreTransform,
  ContractParameters,
  FhenixAbiParametersToPrimitiveTypes as AbiParametersToPrimitiveTypes,
} from 'src/encryptedInputs';
import {
  FheTypes,
  type EncryptedAddressInput,
  type EncryptedBoolInput,
  type EncryptedUint128Input,
  type EncryptedUint16Input,
  type EncryptedUint256Input,
  type EncryptedUint32Input,
  type EncryptedUint64Input,
  type EncryptedUint8Input,
} from '@cofhe/sdk';
import type { ExtractAbiFunction } from 'abitype';

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

const inEuint256: EncryptedUint256Input = {
  ctHash: 1n,
  securityZone: 0,
  utype: FheTypes.Uint256,
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
  assertType<CofheInputArgs<typeof TestABI, 'fnEncryptedInput'>>([inEuint32]);
  assertType<CofheInputArgsPreTransform<typeof TestABI, 'fnEncryptedInput'>>([1n]);
});

test('fnBlendedInputsIncludingEncryptedInput should have parameter type uint256 and InEuint32', () => {
  assertType<CofheInputArgs<typeof TestABI, 'fnBlendedInputsIncludingEncryptedInput'>>([1n, inEuint32]);
  assertType<CofheInputArgsPreTransform<typeof TestABI, 'fnBlendedInputsIncludingEncryptedInput'>>([1n, 1n]);
});

test('fnAllEncryptedInputs should have parameter type InEuint8, InEuint16, InEuint32, InEuint64, InEuint128, InEuint256, InEbool, InEaddress', () => {
  type args = CofheInputArgs<typeof TestABI, 'fnAllEncryptedInputs'>;
  assertType<args>([inEuint8, inEuint16, inEuint32, inEuint64, inEuint128, inEbool, inEaddress]);
  assertType<CofheInputArgsPreTransform<typeof TestABI, 'fnAllEncryptedInputs'>>([
    1n,
    1n,
    1n,
    1n,
    1n,
    true,
    '0x1234567890abcdef',
  ]);
});

test('fnStructContainsEncryptedInput should have parameter type ContainsEncryptedInput', () => {
  type args = CofheInputArgs<typeof TestABI, 'fnStructContainsEncryptedInput'>
  assertType<args>([1]);
  assertType<CofheInputArgsPreTransform<typeof TestABI, 'fnStructContainsEncryptedInput'>>([1]);
});

test('fnArrayContainsEncryptedInput should have parameter type InEuint32[]', () => {
  type aobs = ExtractAbiFunction<typeof TestABI, 'fnBlendedInputsIncludingEncryptedInput'>['inputs'];
  type aobs2 = AbiParametersToPrimitiveTypes<aobs>;

  type test = ContractParameters<typeof TestABI, 'fnArrayContainsEncryptedInput'>;
  assertType<CofheInputArgs<typeof TestABI, 'fnArrayContainsEncryptedInput'>>([1]);
  assertType<CofheInputArgsPreTransform<typeof TestABI, 'fnArrayContainsEncryptedInput'>>([1]);
});
