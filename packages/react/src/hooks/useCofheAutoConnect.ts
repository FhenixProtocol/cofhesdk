import type { PublicClient, WalletClient } from 'viem';
import { useCofheClient } from './useCofheClient';
import { useCallback, useEffect, useMemo } from 'react';
import { useCofheConnect } from './useCofheConnect';

type Input = {
  publicClient?: PublicClient;
  walletClient?: WalletClient;
};
export const useCofheAutoConnect = ({ walletClient, publicClient }: Input) => {
  const client = useCofheClient();

  const connectMutationFn = useCofheConnect().mutate;

  const supportedChainIds = useMemo(() => {
    return new Set(client.config.supportedChains.map((chain) => chain.id));
  }, [client.config.supportedChains]);

  const disconnectIfConnected = useCallback(() => {
    if (client.connected || client.connecting) {
      client.disconnect();
    }
  }, [client]);

  useEffect(() => {
    // Keep COFHE connection in sync with the upstream (wagmi) connection.
    // - if wagmi disconnects, it stops providing clients -> disconnect COFHE
    // - if wagmi provides clients -> ensure COFHE is connected
    if (!publicClient || !walletClient) {
      disconnectIfConnected();
      return;
    }

    const chainId = walletClient.chain?.id ?? publicClient.chain?.id;
    if (chainId !== undefined && !supportedChainIds.has(chainId)) {
      disconnectIfConnected();
      return;
    }

    if (client.connecting) return;
    connectMutationFn({ publicClient, walletClient });
  }, [publicClient, walletClient, client, connectMutationFn, supportedChainIds, disconnectIfConnected]);
};
