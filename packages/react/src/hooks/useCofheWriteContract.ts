import type { Hash, WalletClient } from 'viem';
import type { UseMutationOptions, UseMutationResult } from '@tanstack/react-query';
import { assert } from 'ts-essentials';

import { useCofheWalletClient } from './useCofheConnection';
import { useInternalMutation } from '../providers/index.js';

type CofheWriteContractVariables = Parameters<WalletClient['writeContract']>[0];
/**
 * Generic hook for submitting an on-chain contract write via the CoFHE-connected WalletClient.
 *
 * - Uses the current connected WalletClient from `useCofheConnection()`.
 * - Defaults `account` to `walletClient.account` when not provided.
 * - Normalizes `chain` (treats `null` as `undefined`).
 */

type WriteVariables = Omit<
  Pick<
    CofheWriteContractVariables,
    'args' | 'address' | 'abi' | 'functionName' | 'chain' | 'account' | 'value' // pick only params that make sense and are required, as unspreading the whole type causes tricky ts issues
  >,
  'args'
> & {
  args: Exclude<CofheWriteContractVariables['args'], undefined>;
};

export type VariablesWithExtrasWithArgs<T> = {
  variables: WriteVariables;
  extras: T;
};

export type VariablesWithExtrasWithoutArgs<T> = Omit<VariablesWithExtrasWithArgs<T>, 'variables'> & {
  variables: Omit<WriteVariables, 'args'>;
};

// type ResultsWithExtras<T> = {
//   result: Hash;
//   extras: T;
// };

export type UseCofheWriteContractOptions<TExtras> = Omit<
  UseMutationOptions<Hash, Error, VariablesWithExtrasWithArgs<TExtras>, unknown>,
  'mutationFn'
>;
export function useCofheWriteContract<TExtras>(options?: UseCofheWriteContractOptions<TExtras>): UseMutationResult<
  Hash,
  Error,
  VariablesWithExtrasWithArgs<TExtras>
> & {
  writeContractAsync: (variables: VariablesWithExtrasWithArgs<TExtras>) => Promise<Hash>;
  writeContract: (variables: VariablesWithExtrasWithArgs<TExtras>) => void;
} {
  const walletClient = useCofheWalletClient();

  const mutation = useInternalMutation<Hash, Error, VariablesWithExtrasWithArgs<TExtras>>({
    ...options,
    mutationKey: options?.mutationKey ?? ['cofhe', 'writeContract'],
    mutationFn: async ({ variables, extras }) => {
      assert(walletClient, 'WalletClient is required to write to a contract');

      const account = variables.account ?? walletClient.account;
      if (!account) {
        throw new Error('Wallet account is required to write to a contract');
      }

      const hash = await walletClient.writeContract(variables);

      return hash;
    },
  });

  return {
    ...mutation,
    writeContractAsync: mutation.mutateAsync,
    writeContract: (variables) => mutation.mutate(variables),
  };
}
