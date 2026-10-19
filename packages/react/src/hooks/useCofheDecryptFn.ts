import { useCallback, useMemo } from 'react';
import { useCofheContext, useInternalQueryClient } from '@/providers';
import {
  isHandleOutOfScope,
  useCofheEffectiveACP,
  type CofheACPInput,
  type CofheEffectiveACP,
} from './useCofheACPScope';
import { useCofheChainId } from './useCofheConnection';
import {
  cofheDecryptQuery,
  defaultDecryptRetry,
  useDropDecryptsOfInvalidACP,
  type CofheDecryptContext,
} from './useCofheDecrypt';
import { CofheError, CofheErrorCode, FheTypes, type DecryptPollCallbackFunction, type UnsealedItem } from '@cofhe/sdk';
import type { EncryptedReturnTypeByUtype } from '@cofhe/abi';
import type { CofheDecryptMeta } from '@/meta';

/** Per-call options of the function `useCofheDecryptFn` returns. */
export type CofheDecryptFnOptions = {
  /** Consumer-supplied metadata for debug/activity views. */
  meta?: CofheDecryptMeta;
  /** Structural context from the originating read (address/method), for recognition. */
  context?: CofheDecryptContext;
  onPoll?: DecryptPollCallbackFunction;
  /** The decrypt's whole budget in milliseconds, submit retries and polling together (5 minutes by default). */
  timeoutMs?: number;
  /**
   * A cached plaintext younger than this is returned without a request. `Infinity` by default: a
   * plaintext never changes, so a handle decrypted once (by this function or by `useCofheDecrypt`)
   * is never decrypted again.
   */
  staleTime?: number;
  /** Retry policy of a failed request; by default a `CofheError` is final and anything else is retried 3 times. */
  retry?: boolean | number | ((failureCount: number, error: Error) => boolean);
};

/** Decrypts one handle; see `useCofheDecryptFn`. */
export type CofheDecryptFn = <U extends FheTypes>(
  input: EncryptedReturnTypeByUtype<U>,
  options?: CofheDecryptFnOptions
) => Promise<UnsealedItem<U>>;

export type UseCofheDecryptFnOptions = {
  /**
   * The chain the ciphertexts live on — the connected chain by default. Gates on and decrypts
   * with THAT chain's active ACP, e.g. for values read through a chain-pinned read.
   */
  chainId?: number;
  /**
   * Decrypt with this ACP (or the hash of a stored one) instead of the enclosing
   * `<CofheACPScope>` or the active ACP. The active ACP is not changed.
   */
  acp?: CofheACPInput;
  /** How many requests one caller runs at a time; the rest wait their turn. 4 by default. */
  concurrency?: number;
};

export type UseCofheDecryptFnResult = {
  /** Decrypts one handle through the decrypt cache; rejects without a request while `isReady` is false. */
  decrypt: CofheDecryptFn;
  /** A client and a valid ACP are at hand, so a call can run. */
  isReady: boolean;
  /** The ACP `decrypt` uses, with its status: why `isReady` is false, when it is. */
  acp: CofheEffectiveACP;
};

/** What a zero handle (a value never set on chain) reads as, per type: the type's zero. */
function zeroPlaintext<U extends FheTypes>(utype: U): UnsealedItem<U> {
  if (utype === FheTypes.Bool) return false as UnsealedItem<U>;
  if (utype === FheTypes.Uint160) return '0x0000000000000000000000000000000000000000' as UnsealedItem<U>;
  return 0n as UnsealedItem<U>;
}

/** Runs tasks at most `max` at a time, in call order. */
function createLimiter(max: number): <T>(task: () => Promise<T>) => Promise<T> {
  let active = 0;
  const waiting: Array<() => void> = [];
  return async (task) => {
    if (active >= max) await new Promise<void>((resume) => waiting.push(resume));
    active += 1;
    try {
      return await task();
    } finally {
      active -= 1;
      waiting.shift()?.();
    }
  };
}

/**
 * The imperative counterpart of `useCofheDecrypt`: a function that decrypts one handle on demand,
 * for the work a component does not render per value — a job the user starts over a list of
 * handles (a history to sum, a set of bids to reveal), typically from a `useMutation`.
 *
 * Each call is the same query `useCofheDecrypt` would run — same cache key, same gate, same
 * persistence, same activity row — so a handle decrypted either way is decrypted once, and
 * `decrypt` returns a cached plaintext without a request. Calls run at most `concurrency` at a
 * time; fan out with `Promise.all` freely.
 *
 * Without a valid ACP, or with a SNAPSHOT share that does not list the handle, `decrypt` rejects
 * with a `CofheError` and sends nothing. A zero handle resolves to the type's zero without a request.
 */
export function useCofheDecryptFn({
  chainId,
  acp,
  concurrency = 4,
}: UseCofheDecryptFnOptions = {}): UseCofheDecryptFnResult {
  const { client } = useCofheContext();
  const queryClient = useInternalQueryClient();
  const connectedChainId = useCofheChainId();
  const decryptChainId = chainId ?? connectedChainId;
  const effectiveACP = useCofheEffectiveACP({ acp, chainId });
  useDropDecryptsOfInvalidACP(effectiveACP);
  const limit = useMemo(() => createLimiter(concurrency), [concurrency]);

  const isReady = !!client && effectiveACP.isValid;
  const { acp: decryptACP, scoped, status } = effectiveACP;

  const decrypt = useCallback<CofheDecryptFn>(
    async (input, options) => {
      if (!client) {
        throw new CofheError({ code: CofheErrorCode.InternalError, message: 'CoFHE client not initialized' });
      }
      if (BigInt(input.ctHash) === 0n) return zeroPlaintext(input.utype);
      if (!effectiveACP.isValid) {
        throw new CofheError({
          code: status === 'expired' ? CofheErrorCode.ACPExpired : CofheErrorCode.ACPRequired,
          message: `decrypt: no valid ACP to decrypt with (${status})`,
          hint: 'Create or activate an ACP, or wait for the chosen one to be checked, before decrypting.',
        });
      }
      if (isHandleOutOfScope(scoped ? decryptACP : undefined, input.ctHash)) {
        throw new CofheError({
          code: CofheErrorCode.ACPDenied,
          message: 'decrypt: the handle is not listed in the SNAPSHOT share that would decrypt it',
          context: { ctHash: input.ctHash.toString(), acpHash: decryptACP?.hash },
        });
      }
      const query = cofheDecryptQuery({
        client,
        input,
        decryptChainId,
        chainId,
        acp: decryptACP,
        scoped,
        onPoll: options?.onPoll,
        timeoutMs: options?.timeoutMs,
        meta: options?.meta,
        context: options?.context,
      });
      return limit(() =>
        queryClient.fetchQuery({
          queryKey: query.queryKey,
          queryFn: query.queryFn,
          meta: query.meta,
          staleTime: options?.staleTime ?? Infinity,
          retry: options?.retry ?? defaultDecryptRetry,
        })
      );
    },
    [client, queryClient, decryptChainId, chainId, decryptACP, scoped, status, effectiveACP.isValid, limit]
  );

  return { decrypt, isReady, acp: effectiveACP };
}
