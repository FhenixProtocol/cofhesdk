import { useCofheContext } from '@cofhe/react';
import { useCallback } from 'react';
import { useConnect } from 'wagmi';
import { metaMaskConnector, okxConnector } from './wagmi';

export type WalletType = 'metamask' | 'okx';

export const useConnectBrowserWallet = () => {
  const cofheConfig = useCofheContext().client.config;
  const { connectAsync, isPending: isConnecting } = useConnect();

  const connectBrowserWallet = useCallback(
    async (walletType: WalletType = 'metamask') => {
      const connector = walletType === 'okx' ? okxConnector : metaMaskConnector;
      try {
        await connectAsync({
          connector,
          chainId: cofheConfig.supportedChains[0].id,
        });
      } catch (error) {
        console.error('Failed to connect browser wallet:', error);
        throw error;
      }
    },
    [connectAsync],
  );

  return {
    connectBrowserWallet,
    isConnecting,
  };
};
