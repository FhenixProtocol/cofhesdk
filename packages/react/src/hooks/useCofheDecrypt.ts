import { useEffect } from 'react';
import { useCofheContext, useInternalQuery, useInternalQueryClient } from '@/providers';
import { removeDecryptsOfACPs } from '@/providers/acpDecryptCache';
import { isHandleOutOfScope, useCofheEffectiveACP, type CofheACPInput } from './useCofheACPScope';
import { useCofheChainId } from './useCofheConnection';
import { CofheError, FheTypes, type DecryptPollCallbackFunction, type UnsealedItem } from '@cofhe/sdk';
import type { UseQueryOptions, UseQueryResult } from '@tanstack/react-query';
import { assert } from 'ts-essentials';
import type { EncryptedReturnTypeByUtype } from '@cofhe/abi';
import type { CofheDecryptMeta } from '@/meta';

/**
 * The cache key of one decrypt: a ciphertext handle decrypted on one chain, shaped like the read
 * key — `[prefix, chainId, ctHash, utype, acpHash]`. The chain is part of the key because it selects
 * the ACP and threshold network that answer — the same handle on two chains is two requests.
 * `acpHash` names an explicitly chosen ACP (a hook's `acp` option or a `<CofheACPScope>`) and is
 * `undefined` for the active ACP, so a scoped decrypt never answers an unscoped one: the same handle
 * may be decryptable with a shared ACP and not with the user's own.
 */
export function constructCofheDecryptQueryKey(params: {
  ctHash: string | undefined;
  utype: FheTypes | undefined;
  chainId: number | undefined;
  acpHash?: string;
}): readonly unknown[] {
  return ['decryptCiphertext', params.chainId, params.ctHash, params.utype, params.acpHash];
}

/**
 * Hook to decrypt a ciphertext using the Cofhe client.
 * @param input - Ciphertext and FHE type
 * @param onPoll - Optional callback fired once per decryption poll attempt
 * @param chainId - Chain the ciphertext lives on (default: the connected chain)
 * @param acp - ACP to decrypt with (default: the enclosing `<CofheACPScope>`, else the active ACP)
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
    acp,
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
    /**
     * Decrypt with this ACP (or the hash of a stored one) instead of the enclosing
     * `<CofheACPScope>` or the active ACP. The active ACP is not changed.
     */
    acp?: CofheACPInput;
  },
  queryOptions?: Omit<UseQueryOptions<UnsealedItem<U>, Error, TSeletedData>, 'queryKey' | 'queryFn'>
): UseQueryResult<TSeletedData, Error> {
  const { client } = useCofheContext();
  // The chain this decrypt runs on: the one given, else the connected chain. It picks the ACP
  // below and the threshold network inside the builder, so it is part of the cache key.
  const connectedChainId = useCofheChainId();
  const decryptChainId = chainId ?? connectedChainId;
  // Sealed-output decryption runs against one ACP — the `acp` option, else the enclosing scope's,
  // else the ACTIVE one. Without a currently VALID one the request is guaranteed to fail
  // server-side ("ACP is expired"/missing), so don't fire it at all. Note the ciphertext input may
  // still be present from a cached read taken while the ACP was valid, so this gate cannot be left
  // to the read hook.
  const effectiveACP = useCofheEffectiveACP({ acp, chainId });
  const scopedACP = effectiveACP.scoped ? effectiveACP.acp : undefined;

  // A chosen ACP that is no longer valid (e.g. expired) takes its plaintext with it: the disabled
  // query would otherwise keep serving the value decrypted while it was valid.
  const queryClient = useInternalQueryClient();
  const invalidScopedHash = scopedACP && !effectiveACP.isValid ? scopedACP.hash : undefined;
  useEffect(() => {
    if (invalidScopedHash) removeDecryptsOfACPs(queryClient, new Set([invalidScopedHash]));
  }, [invalidScopedHash, queryClient]);

  const { enabled: userEnabled, meta: optionMeta, ...restQueryOptions } = queryOptions || {};
  // A SNAPSHOT share that does not list this handle can only fail: never send it.
  const outOfScope = isHandleOutOfScope(scopedACP, input?.ctHash);
  const enabled =
    !!input && BigInt(input.ctHash) > 0n && !!client && effectiveACP.isValid && !outOfScope && (userEnabled ?? true);

  return useInternalQuery({
    enabled,
    queryKey: constructCofheDecryptQueryKey({
      ctHash: input?.ctHash.toString(),
      utype: input?.utype,
      chainId: decryptChainId,
      acpHash: scopedACP?.hash,
    }),
    queryFn: async () => {
      assert(input, 'input is guaranteed to be defined by enabled condition');
      const builder = client.decryptForView(input.ctHash, input.utype);
      if (chainId !== undefined) builder.setChainId(chainId);
      if (scopedACP) builder.withACP(scopedACP);
      if (onPoll) builder.onPoll(onPoll);
      return builder.execute();
    },
    meta: {
      // Persist only what the user own ACP decrypts, whether chosen or active: plaintext decrypted
      // with a shared ACP must not outlive the share, so it stays in memory.
      persist: effectiveACP.acp?.type === 'self',
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
