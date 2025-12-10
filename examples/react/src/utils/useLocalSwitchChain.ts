import { useCallback } from 'react';
import { useCofheContext } from '@cofhe/react';
import { useAccount, useSwitchChain as useSwitchWagmiChain } from 'wagmi';
import { createMockWalletAndPublicClient } from './misc';

// handles chain switching both for the currently connected wallet (if any) and for the cofhe client itself
export const useLocalSwitchChain = () => {
  const cofheClient = useCofheContext().client;
  const { isConnected: isWagmiConnected } = useAccount();
  const { switchChainAsync: wagmiSwitchChainAsync } = useSwitchWagmiChain();

  const switchChain = useCallback(
    async (chainId: number) => {
      if (isWagmiConnected) {
        // in case of connected wallet, useAutoConnectCofhe hook will pick it up
        await wagmiSwitchChainAsync({ chainId });
      } else {
        // otherwise, if it's jsut a default mock wallet -- connect the clinet right away
        const { walletClient, publicClient } = createMockWalletAndPublicClient(chainId);
        await cofheClient.connect(publicClient, walletClient);
      }
    },
    [isWagmiConnected, cofheClient, wagmiSwitchChainAsync],
  );

  return switchChain;
};
