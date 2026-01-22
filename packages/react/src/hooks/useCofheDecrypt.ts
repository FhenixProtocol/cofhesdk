import { useCofheContext, useInternalQuery } from '@/providers';
import { FheTypes, type UnsealedItem } from '@cofhe/sdk';
import type { UseQueryOptions, UseQueryResult } from '@tanstack/react-query';
import { useIsCofheErrorActive } from './useIsCofheErrorActive';
import { ErrorCause, withQueryErrorCause } from '@/utils';
import { assert } from 'ts-essentials';

/**
 * Hook to decrypt a ciphertext using the Cofhe SDK client.
 * @param input - Ciphertext and FHE type
 * @param queryOptions - Optional React Query options
 * @returns Decrypted balance as bigint
 */
export function useCofheDecrypt<U extends FheTypes, TSeletedData = UnsealedItem<U>>(
  {
    input: { ciphertext, fheType },
    cause,
  }: {
    input: { ciphertext: bigint | undefined; fheType: U };
    cause: ErrorCause;
  },
  queryOptions?: Omit<UseQueryOptions<UnsealedItem<U>, Error, TSeletedData>, 'queryKey' | 'queryFn'>
): UseQueryResult<TSeletedData, Error> {
  const { client } = useCofheContext();
  const isCofheErrorActive = useIsCofheErrorActive();

  const { enabled: userEnabled, ...restQueryOptions } = queryOptions || {};
  const enabled =
    !!ciphertext &&
    ciphertext > 0n &&
    !isCofheErrorActive &&
    !!client &&
    ciphertext !== undefined &&
    (userEnabled ?? true);

  return useInternalQuery({
    enabled,
    queryKey: ['decryptCiphertext', ciphertext?.toString(), fheType],
    queryFn: withQueryErrorCause(cause, async () => {
      assert(ciphertext, 'ciphertext is guaranteed to be defined by enabled condition');
      return client.decryptHandle(ciphertext, fheType).decrypt();
    }),
    ...restQueryOptions,
  });
}
