import { useEffect } from 'react';
import { useCofheContext, useInternalQuery, useInternalQueryClient } from '@/providers';
import { removeDecryptsOfACPs } from '@/providers/acpDecryptCache';
import {
  isHandleOutOfScope,
  useCofheEffectiveACP,
  type CofheACPInput,
  type CofheEffectiveACP,
} from './useCofheACPScope';
import { useCofheChainId } from './useCofheConnection';
import {
  CofheError,
  FheTypes,
  type CofheClient,
  type DecryptPollCallbackFunction,
  type UnsealedItem,
} from '@cofhe/sdk';
import type { ACP } from '@cofhe/sdk/acps';
import type { UseQueryOptions, UseQueryResult } from '@tanstack/react-query';
import { assert } from 'ts-essentials';
import type { EncryptedReturnTypeByUtype } from '@cofhe/abi';
import type { CofheDecryptMeta, CofheQueryMeta } from '@/meta';
import { anySignal } from '@/utils/abortSignal';

/**
 * The cache key of one decrypt: a ciphertext handle decrypted on one chain, shaped like the read
 * key — `[prefix, chainId, ctHash, utype, acpHash]`. The chain is part of the key because it selects
 * the ACP and threshold network that answer — the same handle on two chains is two requests.
 * `acpHash` names the ACP that decrypts (a hook's `acp` option, a `<CofheACPScope>`, or the active
 * ACP), so a value decrypted with one ACP never answers for another: the same handle may be
 * decryptable with a shared ACP and not with the user's own, also when the active ACP changes.
 */
export function constructCofheDecryptForViewQueryKey(params: {
  ctHash: string | undefined;
  utype: FheTypes | undefined;
  chainId: number | undefined;
  acpHash?: string;
}): readonly unknown[] {
  return ['decryptCiphertext', params.chainId, params.ctHash, params.utype, params.acpHash];
}

/** Structural context from the originating read (address/method), for recognition in activity views. */
export type CofheDecryptContext = { chainId?: number; address?: string; functionName?: string };

/**
 * The default retry policy of a decrypt query: a `CofheError` is the threshold network's (or the
 * SDK's) final answer and is not retried; anything else (a network hiccup) is retried 3 times.
 */
export function defaultDecryptRetry(failureCount: number, error: Error): boolean {
  if (error instanceof CofheError) return false;
  return failureCount < 3;
}

/**
 * The query one decrypt runs as — its key, its `queryFn` and its `meta` — shared by
 * `useCofheDecrypt` and `useCofheDecrypter`, so a value decrypted either way is the same cache
 * entry, persisted under the same rule and listed once in the activity panel.
 */
export function cofheDecryptForViewQuery<U extends FheTypes>(params: {
  client: CofheClient;
  input: EncryptedReturnTypeByUtype<U> | undefined;
  /** The chain the decrypt runs on: the caller's `chainId`, else the connected chain. */
  decryptChainId: number | undefined;
  /** The caller's explicit `chainId`, set on the builder when given. */
  chainId?: number;
  /** The ACP that decrypts, and whether it was chosen explicitly (a hook option or a scope). */
  acp: ACP | undefined;
  scoped: boolean;
  onPoll?: DecryptPollCallbackFunction;
  timeoutMs?: number;
  /** The caller's abort signal; React Query's own (query cancelled) is joined to it in `queryFn`. */
  signal?: AbortSignal;
  meta?: CofheDecryptMeta;
  context?: CofheDecryptContext;
}): {
  queryKey: readonly unknown[];
  queryFn: (context?: { signal?: AbortSignal }) => Promise<UnsealedItem<U>>;
  // Also a plain record: that is what `fetchQuery` and `useQuery` type `meta` as.
  meta: Record<string, unknown> & CofheQueryMeta & { persist: boolean };
} {
  const { client, input, decryptChainId, chainId, acp, scoped, onPoll, timeoutMs, signal, meta, context } = params;
  const scopedACP = scoped ? acp : undefined;
  return {
    queryKey: constructCofheDecryptForViewQueryKey({
      ctHash: input?.ctHash.toString(),
      utype: input?.utype,
      chainId: decryptChainId,
      acpHash: acp?.hash,
    }),
    queryFn: async (queryContext) => {
      assert(input, 'a decrypt query only runs with an input');
      const builder = client.decryptForView(input.ctHash, input.utype);
      if (chainId !== undefined) builder.setChainId(chainId);
      if (scopedACP) builder.withACP(scopedACP);
      if (onPoll) builder.onPoll(onPoll);
      if (timeoutMs !== undefined) builder.setTimeout(timeoutMs);
      const abort = anySignal([signal, queryContext?.signal]);
      if (abort) builder.setSignal(abort);
      return builder.execute();
    },
    meta: {
      // Persist only what the user own ACP decrypts, whether chosen or active: plaintext decrypted
      // with a shared ACP must not outlive the share, so it stays in memory.
      persist: acp?.type === 'self',
      kind: 'cofheDecrypt',
      ctHash: input?.ctHash?.toString(),
      chainId: context?.chainId ?? decryptChainId,
      address: context?.address,
      functionName: context?.functionName,
      consumer: meta,
    },
  };
}

/**
 * An ACP that is no longer valid (e.g. expired) takes its plaintext with it: a disabled query would
 * otherwise keep serving the value decrypted while it was valid. The user own active ACP keeps its
 * values (they are the user own data, and persisted).
 */
export function useDropDecryptsOfInvalidACP(effectiveACP: CofheEffectiveACP): void {
  const queryClient = useInternalQueryClient();
  const decryptACP = effectiveACP.acp;
  const invalidHash =
    decryptACP && !effectiveACP.isValid && (effectiveACP.scoped || decryptACP.type !== 'self')
      ? decryptACP.hash
      : undefined;
  useEffect(() => {
    if (invalidHash) removeDecryptsOfACPs(queryClient, new Set([invalidHash]));
  }, [invalidHash, queryClient]);
}

/**
 * Hook to decrypt a ciphertext using the Cofhe client.
 * @param input - Ciphertext and FHE type
 * @param onPoll - Optional callback fired once per decryption poll attempt
 * @param chainId - Chain the ciphertext lives on (default: the connected chain)
 * @param acp - ACP to decrypt with (default: the enclosing `<CofheACPScope>`, else the active ACP)
 * @param timeoutMs - The decrypt's whole budget, submit retries and polling together (default: 5 minutes)
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
    timeoutMs,
  }: {
    input?: EncryptedReturnTypeByUtype<U>;
    onPoll?: DecryptPollCallbackFunction;
    /** Consumer-supplied metadata for debug/activity views. */
    meta?: CofheDecryptMeta;
    /** Structural context from the originating read (address/method), for recognition. */
    context?: CofheDecryptContext;
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
    /** The decrypt's whole budget in milliseconds, submit retries and polling together (5 minutes by default). */
    timeoutMs?: number;
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
  useDropDecryptsOfInvalidACP(effectiveACP);

  const {
    enabled: userEnabled,
    meta: optionMeta,
    retry = defaultDecryptRetry,
    ...restQueryOptions
  } = queryOptions || {};
  // A SNAPSHOT share that does not list this handle can only fail: never send it.
  const outOfScope = isHandleOutOfScope(scopedACP, input?.ctHash);
  const enabled =
    !!input && BigInt(input.ctHash) > 0n && !!client && effectiveACP.isValid && !outOfScope && (userEnabled ?? true);

  const query = cofheDecryptForViewQuery<U>({
    client,
    input,
    decryptChainId,
    chainId,
    acp: effectiveACP.acp,
    scoped: effectiveACP.scoped,
    onPoll,
    timeoutMs,
    meta,
    context,
  });

  return useInternalQuery({
    enabled,
    queryKey: query.queryKey,
    queryFn: query.queryFn,
    meta: { ...query.meta, ...optionMeta },
    ...restQueryOptions,
    retry,
  });
}
