import { useAccount, usePublicClient, useWalletClient } from 'wagmi';
import { sepolia } from 'wagmi/chains';
import { createMockWalletAndPublicClient } from './misc';
import { useMemo } from 'react';

const DEFAULT_CHAIN_ID = sepolia.id;

/**
 *
 * @returns wagmi wallet if connected, otherwise hardcoded "test wallet" { publicClient: PublicClient; walletClient: WalletClient }
 */
export const usePairForCofhe = () => {
  // TODO: if the user switches in the wallet to a chain that's not supported by the dapp, should show error message or disconnect?
  const { isConnected: isWagmiConnected } = useAccount();
  const wagmiPublicClient = usePublicClient();
  const { data: wagmiWalletClient } = useWalletClient();

  const mockWallet = useMemo(() => {
    // in case of no connected wallet, will reset to this mock wallet on a default chain
    return createMockWalletAndPublicClient(DEFAULT_CHAIN_ID);
  }, []);

  const { publicClient, walletClient } = useMemo(() => {
    if (isWagmiConnected && wagmiPublicClient && wagmiWalletClient) {
      return {
        publicClient: wagmiPublicClient,
        walletClient: wagmiWalletClient,
      };
    }
    return mockWallet;
  }, [isWagmiConnected, wagmiPublicClient, wagmiWalletClient]);

  return { publicClient, walletClient };
};
