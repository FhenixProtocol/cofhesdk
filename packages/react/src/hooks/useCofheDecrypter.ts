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
  cofheDecryptForViewQuery,
  defaultDecryptRetry,
  useDropDecryptsOfInvalidACP,
  type CofheDecryptContext,
} from './useCofheDecrypt';
import { cofheDecryptForTxQuery } from './useCofheDecryptForTx';
import {
  CofheError,
  CofheErrorCode,
  FheTypes,
  type DecryptForTxResult,
  type DecryptPollCallbackFunction,
  type UnsealedItem,
} from '@cofhe/sdk';
import type { EncryptedReturnTypeByUtype } from '@cofhe/abi';
import type { CofheDecryptMeta } from '@/meta';

/** Per-call options of the function `useCofheDecrypter` returns. */
export type CofheDecryptForViewFnOptions = {
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

/** Decrypts one handle; see `useCofheDecrypter`. */
export type CofheDecryptForViewFn = <U extends FheTypes>(
  input: EncryptedReturnTypeByUtype<U>,
  options?: CofheDecryptForViewFnOptions
) => Promise<UnsealedItem<U>>;

/** Per-call options of `decryptForTx`; see `useCofheDecrypter`. */
export type CofheDecryptForTxFnOptions = CofheDecryptForViewFnOptions & {
  /**
   * `null`: the contract allowed the handle publicly (`FHE.allowPublic`), so it decrypts without
   * an ACP and does not wait for one. Otherwise the hook's ACP decrypts, as for `decryptForView`.
   */
  acp?: null;
  /** The account whose stored ACPs resolve the active ACP; the connected account by default. */
  account?: string;
  /** How long a submit-time `404 ct_not_found` (handle not indexed yet) is retried; 10 seconds by default. */
  retry404TimeoutMs?: number;
};

/** Decrypts one handle into a plaintext with the network's signature; see `useCofheDecrypter`. */
export type CofheDecryptForTxFn = (
  ctHash: bigint | string,
  options?: CofheDecryptForTxFnOptions
) => Promise<DecryptForTxResult>;

export type UseCofheDecrypterOptions = {
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

export type UseCofheDecrypterResult = {
  /** Decrypts one handle through the decrypt cache; rejects without a request while `isReady` is false. */
  decryptForView: CofheDecryptForViewFn;
  /**
   * Decrypts one handle into a plaintext with the threshold network's signature, for a contract to
   * verify on chain, through the same cache as `useCofheDecryptForTx`. With `acp: null` it needs
   * only the client, not `isReady`.
   */
  decryptForTx: CofheDecryptForTxFn;
  /** A client and a valid ACP are at hand, so a call can run. */
  isReady: boolean;
  /** The ACP `decryptForView` uses, with its status: why `isReady` is false, when it is. */
  acp: CofheEffectiveACP;
};

/** What a zero handle (a value never set on chain) reads as, per type: the type's zero. */
function zeroPlaintext<U extends FheTypes>(utype: U): UnsealedItem<U> {
  if (utype === FheTypes.Bool) return false as UnsealedItem<U>;
  if (utype === FheTypes.Uint160) return '0x0000000000000000000000000000000000000000' as UnsealedItem<U>;
  return 0n as UnsealedItem<U>;
}

/** The reasons a call must not be sent: no valid ACP, or a SNAPSHOT share that does not list the handle. */
function assertACPDecrypts(effectiveACP: CofheEffectiveACP, ctHash: bigint | string, operation: string): void {
  const { acp, scoped, status } = effectiveACP;
  if (!effectiveACP.isValid) {
    throw new CofheError({
      code: status === 'expired' ? CofheErrorCode.ACPExpired : CofheErrorCode.ACPRequired,
      message: `${operation}: no valid ACP to decrypt with (${status})`,
      hint: 'Create or activate an ACP, or wait for the chosen one to be checked, before decrypting.',
    });
  }
  if (isHandleOutOfScope(scoped ? acp : undefined, ctHash)) {
    throw new CofheError({
      code: CofheErrorCode.ACPDenied,
      message: `${operation}: the handle is not listed in the SNAPSHOT share that would decrypt it`,
      context: { ctHash: ctHash.toString(), acpHash: acp?.hash },
    });
  }
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
 * handles (a history to sum, a set of bids to reveal), from the handler that starts it.
 *
 * Each call is the same query `useCofheDecrypt` would run — same cache key, same gate, same
 * persistence, same activity row — so a handle decrypted either way is decrypted once, and
 * `decryptForView` returns a cached plaintext without a request. Calls run at most `concurrency` at a
 * time; fan out with `Promise.all` freely.
 *
 * Without a valid ACP, or with a SNAPSHOT share that does not list the handle, `decryptForView` rejects
 * with a `CofheError` and sends nothing. A zero handle resolves to the type's zero without a request.
 *
 * `decryptForTx` is the same for a proof — the plaintext with the threshold network's signature,
 * for a contract to verify — through the cache of `useCofheDecryptForTx`. A proof is a read too: a
 * handle maps to one plaintext forever, so a handle proved once is never requested again. `acp:
 * null` decrypts a publicly allowed handle without an ACP, and then needs only the client.
 */
export function useCofheDecrypter({
  chainId,
  acp,
  concurrency = 4,
}: UseCofheDecrypterOptions = {}): UseCofheDecrypterResult {
  const { client } = useCofheContext();
  const queryClient = useInternalQueryClient();
  const connectedChainId = useCofheChainId();
  const decryptChainId = chainId ?? connectedChainId;
  const effectiveACP = useCofheEffectiveACP({ acp, chainId });
  useDropDecryptsOfInvalidACP(effectiveACP);
  const limit = useMemo(() => createLimiter(concurrency), [concurrency]);

  const isReady = !!client && effectiveACP.isValid;
  const { acp: decryptACP, scoped } = effectiveACP;

  const decryptForView = useCallback<CofheDecryptForViewFn>(
    async (input, options) => {
      if (!client) {
        throw new CofheError({ code: CofheErrorCode.InternalError, message: 'CoFHE client not initialized' });
      }
      if (BigInt(input.ctHash) === 0n) return zeroPlaintext(input.utype);
      assertACPDecrypts(effectiveACP, input.ctHash, 'decryptForView');
      const query = cofheDecryptForViewQuery({
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
    [client, queryClient, decryptChainId, chainId, decryptACP, scoped, effectiveACP, limit]
  );

  const decryptForTx = useCallback<CofheDecryptForTxFn>(
    async (ctHash, options) => {
      if (!client) {
        throw new CofheError({ code: CofheErrorCode.InternalError, message: 'CoFHE client not initialized' });
      }
      if (BigInt(ctHash) === 0n) {
        throw new CofheError({
          code: CofheErrorCode.DecryptFailed,
          message: 'decryptForTx: the zero handle has no value to prove',
          hint: 'A zero handle is a value never set on chain; nothing can be revealed from it.',
        });
      }
      const withoutACP = options?.acp === null;
      if (!withoutACP) assertACPDecrypts(effectiveACP, ctHash, 'decryptForTx');
      const query = cofheDecryptForTxQuery({
        client,
        ctHash,
        decryptChainId,
        chainId,
        account: options?.account,
        acp: withoutACP ? null : decryptACP,
        scoped,
        onPoll: options?.onPoll,
        timeoutMs: options?.timeoutMs,
        retry404TimeoutMs: options?.retry404TimeoutMs,
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
    [client, queryClient, decryptChainId, chainId, decryptACP, scoped, effectiveACP, limit]
  );

  return { decryptForView, decryptForTx, isReady, acp: effectiveACP };
}
