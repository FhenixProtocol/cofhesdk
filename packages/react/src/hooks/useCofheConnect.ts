import type { PublicClient, WalletClient } from 'viem';
import { useCofheClient } from './useCofheClient';
import { useInternalMutation } from '@/providers/internalQueryHooks';

type ConnectVars = { publicClient: PublicClient; walletClient: WalletClient };

export const useCofheConnect = () => {
  const client = useCofheClient();
  return useInternalMutation<boolean, Error, ConnectVars>({
    mutationKey: ['cofhe', 'connect'],
    throwOnError: true,
    mutationFn: async ({ publicClient, walletClient }) => {
      const result = await client.connect(publicClient, walletClient);

      // TODO: maybe rather change it internally? so it doesn't suppress error on connection?
      // it's a conventional flow when it comes to connections: try {connect()} catch (e) {show error}
      if (!result) {
        const cause = client.getSnapshot().connectError;
        if (cause) {
          throw cause;
        } else {
          throw new Error('Unknown error during Cofhe client connection');
        }
      }
      return result;
    },
  });
};
