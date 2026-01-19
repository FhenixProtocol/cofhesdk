import { type UseQueryOptions, type UseQueryResult } from '@tanstack/react-query';
import { type Address, type Abi, type ContractFunctionName, type ContractFunctionArgs } from 'viem';
import { FheTypes, type UnsealedItem } from '@cofhe/sdk';
import { ErrorCause } from '@/utils/errors';
import { useCofheDecrypt } from './useCofheDecrypt';
import { useCofheReadContract, type InferredData, type UseCofheReadContractQueryOptions } from './useCofheReadContract';
import { assert } from 'ts-essentials';

/**
 * Generic hook: read a confidential contract value and decrypt it.
 */
export function useCofheReadContractAndDecrypt<
  TFheType extends FheTypes,
  TAbi extends Abi,
  TfunctionName extends ContractFunctionName<TAbi, 'pure' | 'view'>,
  TDecryptedSelectedData = InferredData<TAbi, TfunctionName>,
>(
  params: {
    address?: Address;
    abi?: TAbi;
    functionName?: TfunctionName;
    args?: ContractFunctionArgs<TAbi, 'pure' | 'view', TfunctionName>;
    fheType: TFheType;
    requiresPermit?: boolean;
    potentialDecryptErrorCause: ErrorCause;
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
) {
  // : {
  //   encrypted: UseQueryResult<bigint, Error>;
  //   decrypted: UseQueryResult<TDecryptedSelectedData, Error>;
  //   disabledDueToMissingPermit: boolean;
  // }
  const { address, abi, functionName, args, fheType, requiresPermit = true, potentialDecryptErrorCause } = params;

  const encrypted = useCofheReadContract({ address, abi, functionName, args, requiresPermit }, readQueryOptions);

  const ciphertext = encrypted.data;

  assert(
    typeof ciphertext === 'bigint' || typeof ciphertext === 'undefined',
    'Expected ciphertext to be bigint or undefined'
  );

  let c = ciphertext;

  const decrypted = useCofheDecrypt<TFheType, TDecryptedSelectedData>(
    {
      ciphertext,
      fheType,

      cause: potentialDecryptErrorCause,
    },
    decryptingQueryOptions
  );

  return {
    encrypted,
    decrypted,
    disabledDueToMissingPermit: encrypted.disabledDueToMissingPermit,
  };
}
