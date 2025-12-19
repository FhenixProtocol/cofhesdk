import { useCofheWalletClient } from '@cofhe/react';
import { useEffect } from 'react';
import { useWalletClient } from 'wagmi';

export function useIsUsingBrowserWallet() {
  const { data: wagmiWalletClient } = useWalletClient();
  const cofheWalletClient = useCofheWalletClient();

  useEffect(() => {
    console.log({
      wagmiWalletClient,
      cofheWalletClient,
      isUsingBrowserWallet: wagmiWalletClient === cofheWalletClient,
    });
  }, [wagmiWalletClient, cofheWalletClient]);

  // the true criteria is that both wallet clients are the same instance
  return wagmiWalletClient === cofheWalletClient;
}
