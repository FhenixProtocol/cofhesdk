import { useCofheContext, useInternalQuery } from '@/providers';
import { FheTypes, type UnsealedItem } from '@cofhe/sdk';
import type { UseQueryOptions, UseQueryResult } from '@tanstack/react-query';
import { useIsCofheErrorActive } from './useIsCofheErrorActive';
import { assert } from 'ts-essentials';
import type { EncryptedReturnTypeByUtype } from '@cofhe/abi';

/**
 * Hook to decrypt a ciphertext using the Cofhe SDK client.
 * @param input - Ciphertext and FHE type
 * @param queryOptions - Optional React Query options
 * @returns Decrypted balance as bigint
 */
export function useCofheDecrypt<U extends FheTypes, TSeletedData = UnsealedItem<U>>(
  {
    input,
  }: {
    input?: EncryptedReturnTypeByUtype<U>;
  },
  queryOptions?: Omit<UseQueryOptions<UnsealedItem<U>, Error, TSeletedData>, 'queryKey' | 'queryFn'>
): UseQueryResult<TSeletedData, Error> {
  const { client } = useCofheContext();
  const isCofheErrorActive = useIsCofheErrorActive();

  const { enabled: userEnabled, ...restQueryOptions } = queryOptions || {};
  const enabled = !!input && input.ctHash > 0n && !isCofheErrorActive && !!client && (userEnabled ?? true);

  return useInternalQuery({
    enabled,
    queryKey: ['decryptCiphertext', input?.ctHash.toString(), input?.utype],
    queryFn: async () => {
      assert(input, 'input is guaranteed to be defined by enabled condition');
      return client.decryptHandle(input.ctHash, input.utype).decrypt();
    },
    ...restQueryOptions,
  });
}
