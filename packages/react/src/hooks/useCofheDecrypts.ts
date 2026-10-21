import { useCofheContext, useInternalQueries } from '@/providers';
import { isHandleOutOfScope, useCofheEffectiveACP, type CofheACPInput } from './useCofheACPScope';
import { useCofheChainId } from './useCofheConnection';
import {
  cofheDecryptForViewQuery,
  defaultDecryptRetry,
  useDropDecryptsOfInvalidACP,
  zeroPlaintext,
  type CofheDecryptContext,
} from './useCofheDecrypt';
import type { DecryptPollCallbackFunction, FheTypes, UnsealedItem } from '@cofhe/sdk';
import type { UseQueryOptions, UseQueryResult } from '@tanstack/react-query';
import type { EncryptedReturnTypeByUtype } from '@cofhe/abi';
import type { CofheDecryptMeta } from '@/meta';

export type UseCofheDecryptsInput<U extends FheTypes> = {
  /** The handles to decrypt, in the order the results come back; `undefined` entries stay idle. */
  inputs: ReadonlyArray<EncryptedReturnTypeByUtype<U> | undefined>;
  /** Consumer-supplied metadata for debug/activity views, one for all or one per entry. */
  meta?: CofheDecryptMeta | ((input: EncryptedReturnTypeByUtype<U>, index: number) => CofheDecryptMeta);
  /** Structural context from the originating read (address/method), for recognition. */
  context?: CofheDecryptContext;
  onPoll?: DecryptPollCallbackFunction;
  /**
   * The chain the ciphertexts live on — the connected chain by default. Gates on and decrypts
   * with THAT chain's active ACP.
   */
  chainId?: number;
  /**
   * Decrypt with this ACP (or the hash of a stored one) instead of the enclosing
   * `<CofheACPScope>` or the active ACP. The active ACP is not changed.
   */
  acp?: CofheACPInput;
  /** The decrypt's whole budget in milliseconds, submit retries and polling together (5 minutes by default). */
  timeoutMs?: number;
};

/**
 * `useCofheDecrypt` for a list: one query per handle, the same keys, gate, persistence and
 * activity rows, returned in the order of `inputs`. For a list a component renders, or a total it
 * derives from every value, where the handles are known at render time. The client's
 * `decryptConcurrency` cap bounds how many requests run at once, so a long list is safe.
 *
 * A zero handle — a value never set on chain — reads as the type's zero without a request.
 */
export function useCofheDecrypts<U extends FheTypes, TSelectedData = UnsealedItem<U>>(
  { inputs, meta, context, onPoll, chainId, acp, timeoutMs }: UseCofheDecryptsInput<U>,
  queryOptions?: Omit<UseQueryOptions<UnsealedItem<U>, Error, TSelectedData>, 'queryKey' | 'queryFn'>
): UseQueryResult<TSelectedData, Error>[] {
  const { client } = useCofheContext();
  const connectedChainId = useCofheChainId();
  const decryptChainId = chainId ?? connectedChainId;
  const effectiveACP = useCofheEffectiveACP({ acp, chainId });
  const scopedACP = effectiveACP.scoped ? effectiveACP.acp : undefined;
  useDropDecryptsOfInvalidACP(effectiveACP);

  const {
    enabled: userEnabled,
    meta: optionMeta,
    retry = defaultDecryptRetry,
    ...restQueryOptions
  } = queryOptions || {};

  return useInternalQueries({
    queries: inputs.map((input, index) => {
      const zero = !!input && BigInt(input.ctHash) === 0n;
      const outOfScope = isHandleOutOfScope(scopedACP, input?.ctHash);
      const enabled = !!input && !zero && !!client && effectiveACP.isValid && !outOfScope && (userEnabled ?? true);
      const query = cofheDecryptForViewQuery<U>({
        client,
        input,
        decryptChainId,
        chainId,
        acp: effectiveACP.acp,
        scoped: effectiveACP.scoped,
        onPoll,
        timeoutMs,
        meta: typeof meta === 'function' ? (input ? meta(input, index) : undefined) : meta,
        context,
      });
      return {
        enabled,
        queryKey: query.queryKey,
        queryFn: query.queryFn,
        meta: { ...query.meta, ...optionMeta },
        ...restQueryOptions,
        retry,
        // The zero handle is its own answer: present from the first render, never fetched.
        ...(zero ? { initialData: zeroPlaintext(input.utype), staleTime: Infinity } : {}),
      };
    }),
  }) as UseQueryResult<TSelectedData, Error>[];
}
