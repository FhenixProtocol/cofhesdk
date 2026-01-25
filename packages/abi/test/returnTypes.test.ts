import { transformEncryptedReturnTypes } from 'src/encryptedReturnTypes';
import { describe, it, expect } from 'vitest';
import { TestABI } from './TestABI';
import { Test2ABI } from './Test2ABI';
import { FheTypes } from '@cofhe/sdk';

import type { Abi, ContractFunctionArgs, ContractFunctionName, ReadContractReturnType } from 'viem';
import type { ContractReturnType } from 'src/utils';
// import type { Abi } from 'abitype';

function fromViemTypeToCofheType<
  TAbi extends Abi,
  TfunctionName extends ContractFunctionName<TAbi, 'pure' | 'view'>,
  TArgs extends ContractFunctionArgs<TAbi, 'pure' | 'view', TfunctionName>,
>(
  abi: TAbi,
  functionName: TfunctionName,
  viemValue: ReadContractReturnType<TAbi, TfunctionName, TArgs>
): //the returned type is expected as Data parameters for transformEncryptedReturnTypes
ContractReturnType<TAbi, TfunctionName> {
  // const value_to_use =
  //   typeof viemValue === 'undefined' ? undefined : Array.isArray(viemValue) ? viemValue : [viemValue];

  // const expectedDataType:
  return viemValue as ContractReturnType<TAbi, TfunctionName>;
}

const encBalanceOfResult: ReadContractReturnType<typeof Test2ABI, 'encBalanceOf', readonly [`0x${string}`]> = 1n;
const cofheCompliantParam: ContractReturnType<typeof Test2ABI, 'encBalanceOf', readonly [`0x${string}`]> =
  fromViemTypeToCofheType(Test2ABI, 'encBalanceOf', 1n);
const result = transformEncryptedReturnTypes(Test2ABI, 'encBalanceOf', encBalanceOfResult);

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
