import type { PublicClient, WalletClient } from 'viem';
import type { UseMutationOptions } from '@tanstack/react-query';
import { useCofheClient } from './useCofheClient';
import { useInternalMutation } from '@/providers/internalQueryHooks';

type ConnectVars = { publicClient: PublicClient; walletClient: WalletClient };

type ConnectMutationOptions = Omit<UseMutationOptions<void, Error, ConnectVars, unknown>, 'mutationKey' | 'mutationFn'>;

export const useCofheConnect = (options?: ConnectMutationOptions) => {
  const client = useCofheClient();
  return useInternalMutation<void, Error, ConnectVars>({
    // spread user-provided options first; enforce critical keys afterwards
    ...options,
    mutationKey: ['cofhe', 'connect'],
    mutationFn: async ({ publicClient, walletClient }) => {
      await client.connect(publicClient, walletClient);
    },
  });
};
