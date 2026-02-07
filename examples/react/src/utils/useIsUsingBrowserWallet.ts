import { useCofheWalletClient } from '@cofhe/react';
import { useWalletClient } from 'wagmi';

export function useIsUsingBrowserWallet() {
  const { data: wagmiWalletClient } = useWalletClient();
  const cofheWalletClient = useCofheWalletClient();

  console.log('wagmiWalletClient', wagmiWalletClient);
  console.log('cofheWalletClient', cofheWalletClient);

  // the true criteria is that both wallet clients are the same instance
  return wagmiWalletClient === cofheWalletClient;
}
