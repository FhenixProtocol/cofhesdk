import { useCofheContext } from '@cofhe/react';
import { useEffect } from 'react';
import { useAccount, usePublicClient, useWalletClient } from 'wagmi';
import { sepolia } from 'wagmi/chains';
import { createMockWalletAndPublicClient } from './misc';

const DEFAULT_CHAIN_ID = sepolia.id;

export const useAutoConnectCofhe = () => {
  // TODO: if the user switches in the wallet to a chain that's not supported by the dapp, should show error message or disconnect?
  const cofheClient = useCofheContext().client;
  const { isConnected: isWagmiConnected } = useAccount();
  const publicClient = usePublicClient();
  const { data: walletClient } = useWalletClient();

  useEffect(() => {
    const autoConnect = async () => {
      if (isWagmiConnected && publicClient && walletClient) {
        await cofheClient.connect(publicClient, walletClient);
      } else {
        // in case of no connected wallet, reset to mock wallet on a default chain
        const { walletClient, publicClient } = createMockWalletAndPublicClient(DEFAULT_CHAIN_ID);
        await cofheClient.connect(publicClient, walletClient);
      }
    };
    autoConnect();
  }, [isWagmiConnected, publicClient, walletClient, cofheClient]);
};
