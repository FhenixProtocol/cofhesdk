import { useCofheContext, useInternalQuery } from '@/providers';
import { CofheError, FheTypes, type DecryptPollCallbackFunction, type UnsealedItem } from '@cofhe/sdk';
import type { UseQueryOptions, UseQueryResult } from '@tanstack/react-query';
import { assert } from 'ts-essentials';
import type { EncryptedReturnTypeByUtype } from '@cofhe/abi';

/**
 * Hook to decrypt a ciphertext using the Cofhe client.
 * @param input - Ciphertext and FHE type
 * @param onPoll - Optional callback fired once per decryption poll attempt
 * @param queryOptions - Optional React Query options
 * @returns Decrypted balance as bigint
 */
export function useCofheDecrypt<U extends FheTypes, TSeletedData = UnsealedItem<U>>(
  {
    input,
    onPoll,
  }: {
    input?: EncryptedReturnTypeByUtype<U>;
    onPoll?: DecryptPollCallbackFunction;
  },
  queryOptions?: Omit<UseQueryOptions<UnsealedItem<U>, Error, TSeletedData>, 'queryKey' | 'queryFn'>
): UseQueryResult<TSeletedData, Error> {
  const { client } = useCofheContext();

  const { enabled: userEnabled, ...restQueryOptions } = queryOptions || {};
  const enabled = !!input && BigInt(input.ctHash) > 0n && !!client && (userEnabled ?? true);

  return useInternalQuery({
    enabled,
    queryKey: ['decryptCiphertext', input?.ctHash.toString(), input?.utype],
    queryFn: async () => {
      assert(input, 'input is guaranteed to be defined by enabled condition');
      const builder = client.decryptForView(input.ctHash, input.utype);
      if (onPoll) builder.onPoll(onPoll);
      return builder.execute();
    },
    meta: {
      persist: true,
    },
    ...restQueryOptions,
    retry: (failureCount, error) => {
      if (error instanceof CofheError) return false; // don't retry decryption errors

      // default retry behavior - 3 retries
      return failureCount < 3;
    },
  });
}
