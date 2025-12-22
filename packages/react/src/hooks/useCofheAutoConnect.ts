import type { PublicClient, WalletClient } from 'viem';
import { useCofheClient } from './useCofheClient';
import { useEffect } from 'react';
import { useCofheConnect } from './useCofheConnect';

type Input = {
  publicClient?: PublicClient;
  walletClient?: WalletClient;
};
export const useCofheAutoConnect = ({ walletClient, publicClient }: Input) => {
  // TODO: if the user switches in the wallet to a chain that's not supported by the dapp, should show error message or disconnect?
  const client = useCofheClient();

  const connectMutation = useCofheConnect();

  useEffect(() => {
    if (!publicClient || !walletClient || client.connecting) return;
    connectMutation.mutate({ publicClient, walletClient });
  }, [publicClient, walletClient, client.connecting, connectMutation]);
};
