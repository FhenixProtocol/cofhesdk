import type { PublicClient, WalletClient } from 'viem';
import { useCofheClient } from './useCofheClient';
import { useEffect } from 'react';

type Input = {
  publicClient: PublicClient;
  walletClient: WalletClient;
};
export const useCofheAutoConnect = ({ walletClient, publicClient }: Input) => {
  // TODO: if the user switches in the wallet to a chain that's not supported by the dapp, should show error message or disconnect?
  const client = useCofheClient();

  useEffect(() => {
    const autoConnect = async () => {
      if (!publicClient || !walletClient) return;
      await client.connect(publicClient, walletClient);
    };
    autoConnect();
  }, [publicClient, walletClient, client]);
};
