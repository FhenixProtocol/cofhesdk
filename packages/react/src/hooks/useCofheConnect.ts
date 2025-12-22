import type { PublicClient, WalletClient } from 'viem';
import { useCofheClient } from './useCofheClient';
import { useInternalMutation } from '@/providers/internalQueryHooks';

type ConnectVars = { publicClient: PublicClient; walletClient: WalletClient };

export const useCofheConnect = () => {
  const client = useCofheClient();
  return useInternalMutation<boolean, Error, ConnectVars>({
    mutationKey: ['cofhe', 'connect'],
    mutationFn: async ({ publicClient, walletClient }) => client.connect(publicClient, walletClient),
  });
};
