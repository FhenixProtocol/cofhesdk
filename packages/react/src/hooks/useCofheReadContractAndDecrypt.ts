import { type UseQueryOptions, type UseQueryResult } from '@tanstack/react-query';
import { type Address, type Abi } from 'viem';
import { FheTypes } from '@cofhe/sdk';
import { ErrorCause } from '@/utils/errors';
import { useCofheDecrypt } from './useCofheDecrypt';
import { useCofheReadContract, type UseCofheReadContractQueryOptions } from './useCofheReadContract';

/**
 * Generic hook: read a confidential contract value and decrypt it.
 */
export function useCofheReadContractAndDecrypt<TDecryptedSelectedData = bigint>(
  params: {
    address?: Address;
    abi?: Abi;
    functionName?: string;
    args?: readonly unknown[];
    fheType: FheTypes;
    requiresPermit?: boolean;
    potentialDecryptErrorCause: ErrorCause;
  },

  {
    readQueryOptions,
    decryptingQueryOptions,
  }: {
    readQueryOptions?: UseCofheReadContractQueryOptions;
    decryptingQueryOptions?: Omit<
      UseQueryOptions<string | bigint | boolean, Error, TDecryptedSelectedData>,
      'queryKey' | 'queryFn'
    >;
  } = {}
): {
  encrypted: UseQueryResult<bigint, Error>;
  decrypted: UseQueryResult<TDecryptedSelectedData, Error>;
  disabledDueToMissingPermit: boolean;
} {
  const { address, abi, functionName, args, fheType, requiresPermit = true, potentialDecryptErrorCause } = params;

  const encrypted = useCofheReadContract({ address, abi, functionName, args, requiresPermit }, readQueryOptions);

  const decrypted = useCofheDecrypt(
    {
      ciphertext: encrypted.data,
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
