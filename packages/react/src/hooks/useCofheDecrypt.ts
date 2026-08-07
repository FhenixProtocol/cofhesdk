import { useCofheContext, useInternalQuery } from '@/providers';
import { useCofheActivePermit } from './useCofhePermits';
import { CofheError, FheTypes, type DecryptPollCallbackFunction, type UnsealedItem } from '@cofhe/sdk';
import type { UseQueryOptions, UseQueryResult } from '@tanstack/react-query';
import { assert } from 'ts-essentials';
import type { EncryptedReturnTypeByUtype } from '@cofhe/abi';
import type { CofheDecryptMeta } from '@/meta';

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
    meta,
    context,
  }: {
    input?: EncryptedReturnTypeByUtype<U>;
    onPoll?: DecryptPollCallbackFunction;
    /** Consumer-supplied metadata for debug/activity views. */
    meta?: CofheDecryptMeta;
    /** Structural context from the originating read (address/method), for recognition. */
    context?: { chainId?: number; address?: string; functionName?: string };
  },
  queryOptions?: Omit<UseQueryOptions<UnsealedItem<U>, Error, TSeletedData>, 'queryKey' | 'queryFn'>
): UseQueryResult<TSeletedData, Error> {
  const { client } = useCofheContext();
  // Sealed-output decryption runs against the ACTIVE permit — without a currently VALID
  // one the request is guaranteed to fail server-side ("Permit is expired"/missing), so
  // don't fire it at all. Note the ciphertext input may still be present from a cached
  // read taken while the permit was valid, so this gate cannot be left to the read hook.
  const activePermit = useCofheActivePermit();

  const { enabled: userEnabled, meta: optionMeta, ...restQueryOptions } = queryOptions || {};
  const enabled = !!input && BigInt(input.ctHash) > 0n && !!client && !!activePermit?.isValid && (userEnabled ?? true);

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
      kind: 'cofheDecrypt',
      ctHash: input?.ctHash?.toString(),
      chainId: context?.chainId,
      address: context?.address,
      functionName: context?.functionName,
      consumer: meta,
      ...optionMeta,
    },
    ...restQueryOptions,
    retry: (failureCount, error) => {
      if (error instanceof CofheError) return false; // don't retry decryption errors

      // default retry behavior - 3 retries
      return failureCount < 3;
    },
  });
}
