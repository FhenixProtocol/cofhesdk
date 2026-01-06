import type { PublicClient, WalletClient } from 'viem';
import type { UseMutationOptions } from '@tanstack/react-query';
import { useCofheClient } from './useCofheClient';
import { useInternalMutation } from '@/providers/internalQueryHooks';

type ConnectVars = { publicClient: PublicClient; walletClient: WalletClient };

type ConnectMutationOptions = Omit<
  UseMutationOptions<boolean, Error, ConnectVars, unknown>,
  'mutationKey' | 'mutationFn'
>;

export const useCofheConnect = (options?: ConnectMutationOptions) => {
  const client = useCofheClient();
  return useInternalMutation<boolean, Error, ConnectVars>({
    // spread user-provided options first; enforce critical keys afterwards
    ...options,
    mutationKey: ['cofhe', 'connect'],
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
