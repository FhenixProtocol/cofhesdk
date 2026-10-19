import { useCofheContext, useInternalMutation } from '@/providers';
import type { CofheACPInput } from './useCofheACPScope';
import type { DecryptForTxResult, DecryptPollCallbackFunction } from '@cofhe/sdk';
import type { UseMutationOptions, UseMutationResult } from '@tanstack/react-query';
import { assert } from 'ts-essentials';

export type CofheDecryptForTxVariables = {
  ctHash: bigint | string;
  /**
   * The ACP to decrypt with: an ACP, the hash of a stored one, the active ACP when omitted, or
   * `null` for a handle the contract allowed publicly (`FHE.allowPublic`), which needs none.
   */
  acp?: CofheACPInput | null;
  /** The chain the handle lives on; the connected chain by default. */
  chainId?: number;
  /** The account whose stored ACPs resolve a hash or the active ACP; the connected account by default. */
  account?: string;
  onPoll?: DecryptPollCallbackFunction;
  /** The decrypt's whole budget in milliseconds, submit retries and polling together (5 minutes by default). */
  timeoutMs?: number;
  /** How long a submit-time `404 ct_not_found` (handle not indexed yet) is retried; 10 seconds by default. */
  retry404TimeoutMs?: number;
};

export type UseCofheDecryptForTxOptions = Omit<
  UseMutationOptions<DecryptForTxResult, Error, CofheDecryptForTxVariables, unknown>,
  'mutationFn'
>;

export type UseCofheDecryptForTxResult = UseMutationResult<
  DecryptForTxResult,
  Error,
  CofheDecryptForTxVariables,
  unknown
> & {
  decryptForTx: (variables: CofheDecryptForTxVariables) => void;
  decryptForTxAsync: (variables: CofheDecryptForTxVariables) => Promise<DecryptForTxResult>;
  isDecrypting: boolean;
};

/**
 * Mutation hook around `client.decryptForTx`: decrypts a handle through the threshold network and
 * returns the plaintext with the network's signature, for a contract to verify on chain
 * (`FHE.verifyDecryptResult` / `FHE.publishDecryptResult`). Shaped like `useCofheEncrypt`:
 * `decryptForTxAsync(variables)` resolves with the result, `isDecrypting` while it runs.
 *
 * The result is a proof, not a view: it is not cached and not listed in the activity panel.
 */
export function useCofheDecryptForTx(options?: UseCofheDecryptForTxOptions): UseCofheDecryptForTxResult {
  const { client } = useCofheContext();

  const mutation = useInternalMutation<DecryptForTxResult, Error, CofheDecryptForTxVariables, unknown>({
    ...options,
    mutationKey: options?.mutationKey ?? ['cofhe', 'decryptForTx'],
    mutationFn: async (variables) => {
      assert(client, 'CoFHE client not initialized');
      const { ctHash, acp, chainId, account, onPoll, timeoutMs, retry404TimeoutMs } = variables;

      const builder = client.decryptForTx(ctHash);
      if (chainId !== undefined) builder.setChainId(chainId);
      if (account !== undefined) builder.setAccount(account);
      if (onPoll) builder.onPoll(onPoll);
      if (timeoutMs !== undefined) builder.setTimeout(timeoutMs);
      if (retry404TimeoutMs !== undefined) builder.set404RetryTimeout(retry404TimeoutMs);

      const selected =
        acp === null
          ? builder.withoutACP()
          : acp === undefined
            ? builder.withACP()
            : typeof acp === 'string'
              ? builder.withACP(acp)
              : builder.withACP(acp);
      return selected.execute();
    },
  });

  return {
    ...mutation,
    decryptForTx: (variables) => mutation.mutate(variables),
    decryptForTxAsync: (variables) => mutation.mutateAsync(variables),
    isDecrypting: mutation.isPending,
  };
}
