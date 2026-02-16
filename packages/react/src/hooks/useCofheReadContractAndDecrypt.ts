import { type UseQueryOptions, type UseQueryResult } from '@tanstack/react-query';
import { type Address, type Abi, type ContractFunctionName, type ContractFunctionArgs } from 'viem';
import { FheTypes, type UnsealedItem } from '@cofhe/sdk';
import { useCofheDecrypt } from './useCofheDecrypt';
import {
  useCofheReadContract,
  type UseCofheReadContractQueryOptions,
  type UseCofheReadContractResult,
} from './useCofheReadContract';
import type { CofheFirstReturnFheType, CofheReturnType, EncryptedReturnTypeByUtype } from '@cofhe/abi';

type SupportedFheTypeFromReturn<TAbi extends Abi, TfunctionName extends ContractFunctionName<TAbi, 'pure' | 'view'>> =
  CofheFirstReturnFheType<TAbi, TfunctionName> extends FheTypes
    ? CofheFirstReturnFheType<TAbi, TfunctionName>
    : FheTypes;

function isEncryptedValue<TFheType extends FheTypes>(value: unknown): value is EncryptedReturnTypeByUtype<TFheType> {
  return (
    typeof value === 'object' &&
    value !== null &&
    'ctHash' in value &&
    'utype' in value &&
    Object.values<unknown>(FheTypes).includes(value.utype)
  );
}

function convertCofheReturnTypeToEncryptedReturnType<
  TAbi extends Abi,
  TfunctionName extends ContractFunctionName<TAbi, 'pure' | 'view'>,
  TFheType extends FheTypes,
>(value: CofheReturnType<TAbi, TfunctionName>): EncryptedReturnTypeByUtype<TFheType> {
  if (isEncryptedValue<TFheType>(value)) return value;

  // TODO: convertCofheReturnTypeToEncryptedReturnType -- support for mixed return types (e.g., structs with both encrypted and plain values)
  throw new Error(
    'Auto-decryption now only supports a case where the contract function returns a single encrypted value'
  );
}
/**
 * Generic hook: read a confidential contract value and decrypt it.
 */
// TODO: useCofheReadContractAndDecrypt only works for a scenario when the contract function returns a signle plain encrypted value (i.e. not struct etc)
export function useCofheReadContractAndDecrypt<
  TAbi extends Abi,
  TfunctionName extends ContractFunctionName<TAbi, 'pure' | 'view'>,
  TFheType extends FheTypes = SupportedFheTypeFromReturn<TAbi, TfunctionName>,
  TDecryptedSelectedData = UnsealedItem<TFheType>,
>(
  params: {
    address?: Address;
    abi?: TAbi;
    functionName?: TfunctionName;
    args?: ContractFunctionArgs<TAbi, 'pure' | 'view', TfunctionName>;
    requiresPermit?: boolean;
  },

  {
    readQueryOptions,
    decryptingQueryOptions,
  }: {
    readQueryOptions?: UseCofheReadContractQueryOptions<TAbi, TfunctionName>;
    decryptingQueryOptions?: Omit<
      UseQueryOptions<UnsealedItem<TFheType>, Error, TDecryptedSelectedData>,
      'queryKey' | 'queryFn'
    >;
  } = {}
): {
  encrypted: UseCofheReadContractResult<TAbi, TfunctionName>;
  decrypted: UseQueryResult<TDecryptedSelectedData, Error>;
  disabledDueToMissingPermit: boolean;
} {
  const { address, abi, functionName, args, requiresPermit = true } = params;

  const encrypted = useCofheReadContract({ address, abi, functionName, args, requiresPermit }, readQueryOptions);

  const encryptedData = encrypted.data;

  const asEncryptedReturnType = encryptedData
    ? convertCofheReturnTypeToEncryptedReturnType<TAbi, TfunctionName, TFheType>(encryptedData)
    : undefined;

  const decrypted = useCofheDecrypt(
    {
      input: asEncryptedReturnType,
    },
    decryptingQueryOptions
  );

  return {
    encrypted,
    decrypted,
    disabledDueToMissingPermit: encrypted.disabledDueToMissingPermit,
  };
}
