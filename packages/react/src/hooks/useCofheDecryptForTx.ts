import { useCofheContext, useInternalQuery } from '@/providers';
import { isHandleOutOfScope, useCofheEffectiveACP, type CofheACPInput } from './useCofheACPScope';
import { useCofheChainId } from './useCofheConnection';
import { defaultDecryptRetry, useDropDecryptsOfInvalidACP, type CofheDecryptContext } from './useCofheDecrypt';
import type { CofheClient, DecryptForTxResult, DecryptPollCallbackFunction } from '@cofhe/sdk';
import type { ACP } from '@cofhe/sdk/acps';
import type { UseQueryOptions, UseQueryResult } from '@tanstack/react-query';
import { assert } from 'ts-essentials';
import type { CofheDecryptMeta, CofheQueryMeta } from '@/meta';

/**
 * The cache key of one tx decrypt: a handle decrypted on one chain into a plaintext with the
 * threshold network's signature — `[prefix, chainId, ctHash, acpHash]`. `acpHash` names the ACP
 * that decrypts, or is `null` for a handle the contract allowed publicly, decrypted without one.
 * No `utype` segment: the network signs the plaintext as an integer, whatever the handle's type.
 */
export function constructCofheDecryptForTxQueryKey(params: {
  ctHash: string | undefined;
  chainId: number | undefined;
  acpHash: string | null | undefined;
}): readonly unknown[] {
  return ['decryptForTx', params.chainId, params.ctHash, params.acpHash];
}

/**
 * The query one tx decrypt runs as — its key, its `queryFn` and its `meta` — shared by
 * `useCofheDecryptForTx` and `useCofheDecryptFn`, so a proof fetched either way is the same cache
 * entry. A proof is a read: a handle maps to one plaintext forever and the contract verifies only
 * `(ctHash, value, signature)`, so nothing but the handle and the ACP keys it.
 */
export function cofheDecryptForTxQuery(params: {
  client: CofheClient;
  ctHash: bigint | string | undefined;
  /** The chain the decrypt runs on: the caller's `chainId`, else the connected chain. */
  decryptChainId: number | undefined;
  /** The caller's explicit `chainId`, set on the builder when given. */
  chainId?: number;
  /** The account whose stored ACPs resolve the active ACP, set on the builder when given. */
  account?: string;
  /**
   * The ACP that decrypts, and whether it was chosen explicitly (a hook option or a scope);
   * `null` for a publicly allowed handle (`FHE.allowPublic`), which needs none.
   */
  acp: ACP | null | undefined;
  scoped: boolean;
  onPoll?: DecryptPollCallbackFunction;
  timeoutMs?: number;
  retry404TimeoutMs?: number;
  meta?: CofheDecryptMeta;
  context?: CofheDecryptContext;
}): {
  queryKey: readonly unknown[];
  queryFn: () => Promise<DecryptForTxResult>;
  // Also a plain record: that is what `fetchQuery` and `useQuery` type `meta` as.
  meta: Record<string, unknown> & CofheQueryMeta & { persist: boolean };
} {
  const { client, ctHash, decryptChainId, chainId, account, acp, scoped, onPoll, timeoutMs, retry404TimeoutMs } =
    params;
  const { meta, context } = params;
  const scopedACP = scoped && acp ? acp : undefined;
  return {
    queryKey: constructCofheDecryptForTxQueryKey({
      ctHash: ctHash?.toString(),
      chainId: decryptChainId,
      acpHash: acp === null ? null : acp?.hash,
    }),
    queryFn: async () => {
      assert(ctHash !== undefined, 'a tx decrypt query only runs with a handle');
      const builder = client.decryptForTx(ctHash);
      if (chainId !== undefined) builder.setChainId(chainId);
      if (account !== undefined) builder.setAccount(account);
      if (onPoll) builder.onPoll(onPoll);
      if (timeoutMs !== undefined) builder.setTimeout(timeoutMs);
      if (retry404TimeoutMs !== undefined) builder.set404RetryTimeout(retry404TimeoutMs);
      const selected = acp === null ? builder.withoutACP() : scopedACP ? builder.withACP(scopedACP) : builder.withACP();
      return selected.execute();
    },
    meta: {
      // Same rule as a view decrypt: persist what the user own ACP decrypts. A publicly allowed
      // handle's proof is public data, so it persists too; one decrypted with a shared ACP must
      // not outlive the share, so it stays in memory.
      persist: acp === null || acp?.type === 'self',
      kind: 'cofheDecryptForTx',
      ctHash: ctHash?.toString(),
      chainId: context?.chainId ?? decryptChainId,
      address: context?.address,
      functionName: context?.functionName,
      consumer: meta,
    },
  };
}

export type UseCofheDecryptForTxInput = {
  /** The handle to decrypt; the query is disabled without one, or for the zero handle. */
  ctHash?: bigint | string;
  /**
   * The ACP to decrypt with: an ACP, the hash of a stored one, the enclosing `<CofheACPScope>`
   * or the active ACP when omitted, or `null` for a handle the contract allowed publicly
   * (`FHE.allowPublic`), which needs none and so never waits for one.
   */
  acp?: CofheACPInput | null;
  /**
   * The chain the handle lives on — the connected chain by default. Gates on and decrypts
   * with THAT chain's active ACP, e.g. for a value read through a chain-pinned read.
   */
  chainId?: number;
  /** The account whose stored ACPs resolve a hash or the active ACP; the connected account by default. */
  account?: string;
  onPoll?: DecryptPollCallbackFunction;
  /** The decrypt's whole budget in milliseconds, submit retries and polling together (5 minutes by default). */
  timeoutMs?: number;
  /** How long a submit-time `404 ct_not_found` (handle not indexed yet) is retried; 10 seconds by default. */
  retry404TimeoutMs?: number;
  /** Consumer-supplied metadata for debug/activity views. */
  meta?: CofheDecryptMeta;
  /** Structural context from the originating read (address/method), for recognition. */
  context?: CofheDecryptContext;
};

/**
 * Query hook around `client.decryptForTx`: the plaintext of a handle with the threshold network's
 * signature over it, for a contract to verify on chain (`FHE.verifyDecryptResult` /
 * `FHE.publishDecryptResult`). The declarative counterpart of `useCofheDecryptFn().decryptForTx`:
 * mount it on the page that will send the transaction and the proof is ready before the click.
 *
 * A proof never changes, so the query is `staleTime: Infinity` by default and a handle proved
 * once (either way) is never requested again. Like `useCofheDecrypt` it waits for a valid ACP
 * rather than prompting for one — unless `acp` is `null`, when no ACP is involved at all.
 */
export function useCofheDecryptForTx<TSelectedData = DecryptForTxResult>(
  { ctHash, acp, chainId, account, onPoll, timeoutMs, retry404TimeoutMs, meta, context }: UseCofheDecryptForTxInput,
  queryOptions?: Omit<UseQueryOptions<DecryptForTxResult, Error, TSelectedData>, 'queryKey' | 'queryFn'>
): UseQueryResult<TSelectedData, Error> {
  const { client } = useCofheContext();
  const connectedChainId = useCofheChainId();
  const decryptChainId = chainId ?? connectedChainId;
  const withoutACP = acp === null;
  // With `acp: null` the ACP below is not used; the hook still runs (hooks are unconditional) and
  // its drop effect is the same one `useCofheDecrypt` runs for that ACP.
  const effectiveACP = useCofheEffectiveACP({ acp: acp ?? undefined, chainId });
  const scopedACP = effectiveACP.scoped ? effectiveACP.acp : undefined;
  useDropDecryptsOfInvalidACP(effectiveACP);

  const {
    enabled: userEnabled,
    meta: optionMeta,
    retry = defaultDecryptRetry,
    staleTime = Infinity,
    ...restQueryOptions
  } = queryOptions || {};
  const outOfScope = !withoutACP && isHandleOutOfScope(scopedACP, ctHash);
  const enabled =
    ctHash !== undefined &&
    BigInt(ctHash) > 0n &&
    !!client &&
    (withoutACP || effectiveACP.isValid) &&
    !outOfScope &&
    (userEnabled ?? true);

  const query = cofheDecryptForTxQuery({
    client,
    ctHash,
    decryptChainId,
    chainId,
    account,
    acp: withoutACP ? null : effectiveACP.acp,
    scoped: effectiveACP.scoped,
    onPoll,
    timeoutMs,
    retry404TimeoutMs,
    meta,
    context,
  });

  return useInternalQuery({
    enabled,
    queryKey: query.queryKey,
    queryFn: query.queryFn,
    meta: { ...query.meta, ...optionMeta },
    staleTime,
    ...restQueryOptions,
    retry,
  });
}
