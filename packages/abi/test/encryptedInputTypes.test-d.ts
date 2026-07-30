import { assertType, test } from 'vitest';
import { TestABI } from './TestABI';
import type { CofheInputArgs, CofheInputArgsPreTransform } from 'src/encryptedInputs';
import type { MaybeExtractArrayParameterType } from 'src/utils';
import type {
  ExternalAddressHash,
  ExternalBoolHash,
  ExternalUint128Hash,
  ExternalUint16Hash,
  ExternalUint32Hash,
  ExternalUint64Hash,
  ExternalUint8Hash,
} from '@cofhe/sdk';

const hash32 = null as unknown as ExternalUint32Hash;
const hash8 = null as unknown as ExternalUint8Hash;
const hash16 = null as unknown as ExternalUint16Hash;
const hash64 = null as unknown as ExternalUint64Hash;
const hash128 = null as unknown as ExternalUint128Hash;
const hashBool = null as unknown as ExternalBoolHash;
const hashAddress = null as unknown as ExternalAddressHash;
const signature = '0x1234567890abcdef' as const;

test('fnNoEncryptedInputs should have parameter type uint8', () => {
  assertType<CofheInputArgs<typeof TestABI, 'fnNoEncryptedInputs'>>([1]);
  assertType<CofheInputArgsPreTransform<typeof TestABI, 'fnNoEncryptedInputs'>>([1]);
});

test('fnEncryptedInput should have parameter type [externalEuint32, bytes]', () => {
  type args = CofheInputArgs<typeof TestABI, 'fnEncryptedInput'>;
  assertType<args>([hash32, signature]);

  // Pre-transform args drop the trailing signature slot - only the raw value remains.
  type preTransform = CofheInputArgsPreTransform<typeof TestABI, 'fnEncryptedInput'>;
  assertType<preTransform>([1n]);
});

test('fnBlendedInputsIncludingEncryptedInput should have parameter type [uint256, externalEuint32, bytes]', () => {
  type args = CofheInputArgs<typeof TestABI, 'fnBlendedInputsIncludingEncryptedInput'>;
  assertType<args>([1n, hash32, signature]);

  type preTransform = CofheInputArgsPreTransform<typeof TestABI, 'fnBlendedInputsIncludingEncryptedInput'>;
  assertType<preTransform>([1n, 1n]);
});

test('fnAllEncryptedInputs should have parameter type externalEuint8/16/32/64/128/ebool/eaddress + bytes', () => {
  type args = CofheInputArgs<typeof TestABI, 'fnAllEncryptedInputs'>;
  assertType<args>([hash8, hash16, hash32, hash64, hash128, hashBool, hashAddress, signature]);

  type preTransform = CofheInputArgsPreTransform<typeof TestABI, 'fnAllEncryptedInputs'>;
  assertType<preTransform>([1n, 1n, 1n, 1n, 1n, true, '0x1234567890abcdef']);
});

test('fnStructContainsEncryptedInput should have parameter type [ContainsEncryptedInput, bytes]', () => {
  type args = CofheInputArgs<typeof TestABI, 'fnStructContainsEncryptedInput'>;
  assertType<args>([{ value: 1n, encryptedInput: hash32 }, signature]);

  type preTransform = CofheInputArgsPreTransform<typeof TestABI, 'fnStructContainsEncryptedInput'>;
  assertType<preTransform>([{ value: 1n, encryptedInput: 1n }]);
});

test('fnArrayContainsEncryptedInput should have parameter type [externalEuint32[], bytes]', () => {
  type args = CofheInputArgs<typeof TestABI, 'fnArrayContainsEncryptedInput'>;
  assertType<args>([[hash32], signature]);

  type preTransform = CofheInputArgsPreTransform<typeof TestABI, 'fnArrayContainsEncryptedInput'>;
  assertType<preTransform>([[1n]]);
});

test('fnTupleContainsEncryptedInput should have parameter type [externalEuint32[2], bytes]', () => {
  type args = CofheInputArgs<typeof TestABI, 'fnTupleContainsEncryptedInput'>;
  assertType<args>([[hash32, hash32], signature]);

  type preTransform = CofheInputArgsPreTransform<typeof TestABI, 'fnTupleContainsEncryptedInput'>;
  assertType<preTransform>([[1n, 1n]]);
});

test('extractArrayParameterType should return [externalEuint32, 2]', () => {
  type test = MaybeExtractArrayParameterType<'externalEuint32[2]'>;
  assertType<test>(['externalEuint32', '2']);

  type test2 = MaybeExtractArrayParameterType<'externalEuint32[]'>;
  assertType<test2>(['externalEuint32', '']);
});
