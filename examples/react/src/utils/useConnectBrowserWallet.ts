import { useCofheContext } from '@cofhe/react';
import { useCallback } from 'react';
import { useConnect } from 'wagmi';
import { injectedProvider } from './wagmi';

// Wagmi injected connector instance: dynamically connect upon clicking on a "Connect" button to avoid auto-connect
// const injectedProvider = injected({ shimDisconnect: true });

export const useConnectBrowserWallet = () => {
  const cofheConfig = useCofheContext().client.config;
  const { connectAsync, isPending: isConnecting } = useConnect();
  // Connect browser wallet function
  const connectBrowserWallet = useCallback(async () => {
    try {
      // Connect via wagmi, force to switch to the supported chain (as it can be on unsupported, in such case this will throw an error)
      await connectAsync({
        connector: injectedProvider,
        chainId: cofheConfig.supportedChains[0].id,
      });

      // The useAutoConnectCofhe will handle reconnecting cofhe client when walletClient changes
    } catch (error) {
      console.error('Failed to connect browser wallet:', error);
      throw error;
    }
  }, [connectAsync]);

  return {
    connectBrowserWallet,
    isConnecting,
  };
};
