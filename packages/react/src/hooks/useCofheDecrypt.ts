import { useCofheContext, useInternalQuery } from '@/providers';
import { useCofheActiveACP } from './useCofheACPs';
import { useCofheChainId } from './useCofheConnection';
import { CofheError, FheTypes, type DecryptPollCallbackFunction, type UnsealedItem } from '@cofhe/sdk';
import type { UseQueryOptions, UseQueryResult } from '@tanstack/react-query';
import { assert } from 'ts-essentials';
import type { EncryptedReturnTypeByUtype } from '@cofhe/abi';
import type { CofheDecryptMeta } from '@/meta';

/**
 * The cache key of one decrypt: a ciphertext handle decrypted on one chain. The chain is part of
 * the key because it selects the ACP and threshold network that answer — the same handle on two
 * chains is two requests. It sits last so observers indexing by `key[1]` (the ctHash) keep working.
 */
export function constructCofheDecryptQueryKey(params: {
  ctHash: string | undefined;
  utype: FheTypes | undefined;
  chainId: number | undefined;
}): readonly unknown[] {
  return ['decryptCiphertext', params.ctHash, params.utype, params.chainId];
}

/**
 * Hook to decrypt a ciphertext using the Cofhe client.
 * @param input - Ciphertext and FHE type
 * @param onPoll - Optional callback fired once per decryption poll attempt
 * @param chainId - Chain the ciphertext lives on (default: the connected chain)
 * @param queryOptions - Optional React Query options
 * @returns Decrypted balance as bigint
 */
export function useCofheDecrypt<U extends FheTypes, TSeletedData = UnsealedItem<U>>(
  {
    input,
    onPoll,
    meta,
    context,
    chainId,
  }: {
    input?: EncryptedReturnTypeByUtype<U>;
    onPoll?: DecryptPollCallbackFunction;
    /** Consumer-supplied metadata for debug/activity views. */
    meta?: CofheDecryptMeta;
    /** Structural context from the originating read (address/method), for recognition. */
    context?: { chainId?: number; address?: string; functionName?: string };
    /**
     * The chain the ciphertext lives on — the connected chain by default. Gates on and decrypts
     * with THAT chain's active ACP, e.g. for a value read through a chain-pinned read.
     */
    chainId?: number;
  },
  queryOptions?: Omit<UseQueryOptions<UnsealedItem<U>, Error, TSeletedData>, 'queryKey' | 'queryFn'>
): UseQueryResult<TSeletedData, Error> {
  const { client } = useCofheContext();
  // The chain this decrypt runs on: the one given, else the connected chain. It picks the ACP
  // below and the threshold network inside the builder, so it is part of the cache key.
  const connectedChainId = useCofheChainId();
  const decryptChainId = chainId ?? connectedChainId;
  // Sealed-output decryption runs against the ACTIVE ACP — without a currently VALID
  // one the request is guaranteed to fail server-side ("ACP is expired"/missing), so
  // don't fire it at all. Note the ciphertext input may still be present from a cached
  // read taken while the ACP was valid, so this gate cannot be left to the read hook.
  const activeACP = useCofheActiveACP(chainId);

  const { enabled: userEnabled, meta: optionMeta, ...restQueryOptions } = queryOptions || {};
  const enabled = !!input && BigInt(input.ctHash) > 0n && !!client && !!activeACP?.isValid && (userEnabled ?? true);

  return useInternalQuery({
    enabled,
    queryKey: constructCofheDecryptQueryKey({
      ctHash: input?.ctHash.toString(),
      utype: input?.utype,
      chainId: decryptChainId,
    }),
    queryFn: async () => {
      assert(input, 'input is guaranteed to be defined by enabled condition');
      const builder = client.decryptForView(input.ctHash, input.utype);
      if (chainId !== undefined) builder.setChainId(chainId);
      if (onPoll) builder.onPoll(onPoll);
      return builder.execute();
    },
    meta: {
      persist: true,
      kind: 'cofheDecrypt',
      ctHash: input?.ctHash?.toString(),
      chainId: context?.chainId ?? decryptChainId,
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
