import type { UseMutationOptions, UseMutationResult } from '@tanstack/react-query';
import type { Hash, WalletClient } from 'viem';
import { assert } from 'ts-essentials';
import { useInternalMutation } from '../providers/index.js';
import { useCofheWalletClient } from './useCofheConnection.js';

type WalletWriteContractParams = Parameters<WalletClient['writeContract']>[0];

export type UseCofheWalletWriteContractMutationOptions = Omit<
  UseMutationOptions<Hash, Error, WalletWriteContractParams, unknown>,
  'mutationFn'
>;

/**
 * Low-level mutation hook: call `walletClient.writeContract`.
 *
 * Unlike `useCofheWriteContract`, this accepts viem's full `writeContract` parameter type.
 */
export function useCofheWalletWriteContractMutation(
  options?: UseCofheWalletWriteContractMutationOptions
): UseMutationResult<Hash, Error, WalletWriteContractParams, unknown> & {
  writeContractAsync: (params: WalletWriteContractParams) => Promise<Hash>;
  writeContract: (params: WalletWriteContractParams) => void;
} {
  const walletClient = useCofheWalletClient();

  const mutation = useInternalMutation<Hash, Error, WalletWriteContractParams, unknown>({
    ...options,
    mutationKey: options?.mutationKey ?? ['cofhe', 'walletWriteContract'],
    mutationFn: async (params) => {
      assert(walletClient, 'WalletClient is required to write to a contract');
      return walletClient.writeContract(params);
    },
  });

  return {
    ...mutation,
    writeContractAsync: mutation.mutateAsync,
    writeContract: mutation.mutate,
  };
}
