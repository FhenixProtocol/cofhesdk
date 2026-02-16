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

  const connectMutationFn = useCofheConnect().mutate;

  useEffect(() => {
    // Keep COFHE connection in sync with the upstream (wagmi) connection.
    // - if wagmi disconnects, it stops providing clients -> disconnect COFHE
    // - if wagmi provides clients -> ensure COFHE is connected
    if (!publicClient || !walletClient) {
      if (client.connected || client.connecting) {
        client.disconnect();
      }
      return;
    }

    if (client.connecting) return;
    connectMutationFn({ publicClient, walletClient });
  }, [publicClient, walletClient, client, client.connected, client.connecting, connectMutationFn]);
};
