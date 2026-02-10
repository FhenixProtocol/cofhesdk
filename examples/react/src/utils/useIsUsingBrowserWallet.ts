import { useCofheWalletClient } from '@cofhe/react';
import { useWalletClient } from 'wagmi';

export function useIsUsingBrowserWallet() {
  const { data: wagmiWalletClient } = useWalletClient();
  const cofheWalletClient = useCofheWalletClient();

  // the true criteria is that both wallet clients are the same instance
  return wagmiWalletClient === cofheWalletClient && wagmiWalletClient !== undefined;
}
