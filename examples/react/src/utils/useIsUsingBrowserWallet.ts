import { useCofheContext } from '@cofhe/react';
import { usePublicClient, useWalletClient } from 'wagmi';

export function useIsUsingBrowserWallet() {
  const wagmiPublicClient = usePublicClient();
  const { data: wagmiWalletClient } = useWalletClient();

  const cofhePublicClient = useCofheContext().client.getPublicClient();
  const cofheWalletClient = useCofheContext().client.getWalletClient();

  console.log({
    wagmiPublicClient,
    cofhePublicClient,
    wagmiWalletClient,
    cofheWalletClient,
    'wagmi === cofhe public': wagmiPublicClient === cofhePublicClient,
    'wagmi === cofhe wallet': wagmiWalletClient === cofheWalletClient,
  });

  return wagmiWalletClient === cofheWalletClient;
}
