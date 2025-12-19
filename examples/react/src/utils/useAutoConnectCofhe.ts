import { useAccount, usePublicClient, useWalletClient } from 'wagmi';
import { sepolia } from 'wagmi/chains';
import { createMockWalletAndPublicClient } from './misc';
import { useMemo } from 'react';
import { useCofheAutoConnect } from '@cofhe/react';

const DEFAULT_CHAIN_ID = sepolia.id;

/**
 *
 * @returns wagmi wallet if connected, otherwise hardcoded "test wallet" { publicClient: PublicClient; walletClient: WalletClient }
 */
const usePairForCofhe = () => {
  // TODO: if the user switches in the wallet to a chain that's not supported by the dapp, should show error message or disconnect?
  const { isConnected: isWagmiConnected } = useAccount();
  const wagmiPublicClient = usePublicClient();
  const { data: wagmiWalletClient } = useWalletClient();

  const { publicClient, walletClient } = useMemo(() => {
    if (isWagmiConnected && wagmiPublicClient && wagmiWalletClient) {
      return {
        publicClient: wagmiPublicClient,
        walletClient: wagmiWalletClient,
      };
    }
    // in case of no connected wallet, reset to mock wallet on a default chain
    return createMockWalletAndPublicClient(DEFAULT_CHAIN_ID);
  }, [isWagmiConnected, wagmiPublicClient, wagmiWalletClient]);

  return { publicClient, walletClient };
};

export const useAutoConnectCofhe = () => {
  const { publicClient, walletClient } = usePairForCofhe();
  useCofheAutoConnect({ publicClient, walletClient });
};
