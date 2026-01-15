import type { Hash, WalletClient } from 'viem';
import type { UseMutationOptions, UseMutationResult } from '@tanstack/react-query';
import { assert } from 'ts-essentials';

import { useCofheWalletClient } from './useCofheConnection';
import { useInternalMutation } from '../providers/index.js';

type WriteContractSingleParam = Parameters<WalletClient['writeContract']>[0];
/**
 * Generic hook for submitting an on-chain contract write via the CoFHE-connected WalletClient.
 *
 * - Uses the current connected WalletClient from `useCofheConnection()`.
 * - Defaults `account` to `walletClient.account` when not provided.
 * - Normalizes `chain` (treats `null` as `undefined`).
 */

type WriteContractInput = Omit<
  Pick<
    WriteContractSingleParam,
    'args' | 'address' | 'abi' | 'functionName' | 'chain' | 'account' | 'value' // pick only params that make sense and are required, as unspreading the whole type causes tricky ts issues
  >,
  'args'
> & {
  args: Exclude<WriteContractSingleParam['args'], undefined>;
};

// normal .writeContractAsync(input) with ['args'] + {extras: T}
export type WriteContractInputWithExtras<T> = {
  writeContractInput: WriteContractInput;
  extras: T;
};

export type UseCofheWriteContractOptions<TExtras> = Omit<
  UseMutationOptions<Hash, Error, WriteContractInputWithExtras<TExtras>, unknown>,
  'mutationFn'
>;
export function useCofheWriteContract<TExtras>(options?: UseCofheWriteContractOptions<TExtras>): UseMutationResult<
  Hash,
  Error,
  WriteContractInputWithExtras<TExtras>
> & {
  writeContractAsync: (arg: WriteContractInputWithExtras<TExtras>) => Promise<Hash>;
  writeContract: (arg: WriteContractInputWithExtras<TExtras>) => void;
} {
  const walletClient = useCofheWalletClient();

  const mutation = useInternalMutation<Hash, Error, WriteContractInputWithExtras<TExtras>>({
    ...options,
    mutationKey: options?.mutationKey ?? ['cofhe', 'writeContract'],
    mutationFn: async ({ writeContractInput }) => {
      assert(walletClient, 'WalletClient is required to write to a contract');

      return walletClient.writeContract(writeContractInput);
    },
  });

  return {
    ...mutation,
    writeContractAsync: mutation.mutateAsync,
    writeContract: mutation.mutate,
  };
}
