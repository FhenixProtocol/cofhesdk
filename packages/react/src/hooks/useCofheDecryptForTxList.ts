import { useCofheContext, useInternalQueries } from '@/providers';
import { isHandleOutOfScope, useCofheEffectiveACP, type CofheACPInput } from './useCofheACPScope';
import { useCofheChainId } from './useCofheConnection';
import { defaultDecryptRetry, useDropDecryptsOfInvalidACP, type CofheDecryptContext } from './useCofheDecrypt';
import { cofheDecryptForTxQuery } from './useCofheDecryptForTx';
import type { DecryptForTxResult, DecryptPollCallbackFunction } from '@cofhe/sdk';
import type { UseQueryOptions, UseQueryResult } from '@tanstack/react-query';
import type { CofheDecryptMeta } from '@/meta';

export type UseCofheDecryptForTxListInput = {
  /** The handles to prove, in the order the results come back; `undefined` entries and the zero handle stay idle. */
  inputs: ReadonlyArray<bigint | string | undefined>;
  /**
   * The ACP to decrypt with: an ACP, the hash of a stored one, the enclosing `<CofheACPScope>`
   * or the active ACP when omitted, or `null` for handles the contract allowed publicly
   * (`FHE.allowPublic`), which need none and so never wait for one.
   */
  acp?: CofheACPInput | null;
  /** The chain the handles live on — the connected chain by default. */
  chainId?: number;
  /** The account whose stored ACPs resolve a hash or the active ACP; the connected account by default. */
  account?: string;
  onPoll?: DecryptPollCallbackFunction;
  /** The decrypt's whole budget in milliseconds, submit retries and polling together (5 minutes by default). */
  timeoutMs?: number;
  /** How long a submit-time `404 ct_not_found` (handle not indexed yet) is retried; 10 seconds by default. */
  retry404TimeoutMs?: number;
  /** Consumer-supplied metadata for debug/activity views, one for all or one per entry. */
  meta?: CofheDecryptMeta | ((ctHash: bigint | string, index: number) => CofheDecryptMeta);
  /** Structural context from the originating read (address/method), for recognition. */
  context?: CofheDecryptContext;
};

/**
 * `useCofheDecryptForTx` for a list: one proof query per handle, the same keys, gate and
 * persistence, returned in the order of `inputs`. For a page that will send one transaction per
 * item, or one transaction over all of them, with the handles known at render time; the proofs
 * are ready before the click. The client's `decryptConcurrency` cap bounds how many requests run
 * at once.
 */
export function useCofheDecryptForTxList<TSelectedData = DecryptForTxResult>(
  { inputs, acp, chainId, account, onPoll, timeoutMs, retry404TimeoutMs, meta, context }: UseCofheDecryptForTxListInput,
  queryOptions?: Omit<UseQueryOptions<DecryptForTxResult, Error, TSelectedData>, 'queryKey' | 'queryFn'>
): UseQueryResult<TSelectedData, Error>[] {
  const { client } = useCofheContext();
  const connectedChainId = useCofheChainId();
  const decryptChainId = chainId ?? connectedChainId;
  const withoutACP = acp === null;
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

  return useInternalQueries({
    queries: inputs.map((ctHash, index) => {
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
        meta: typeof meta === 'function' ? (ctHash !== undefined ? meta(ctHash, index) : undefined) : meta,
        context,
      });
      return {
        enabled,
        queryKey: query.queryKey,
        queryFn: query.queryFn,
        meta: { ...query.meta, ...optionMeta },
        staleTime,
        ...restQueryOptions,
        retry,
      };
    }),
  }) as UseQueryResult<TSelectedData, Error>[];
}
