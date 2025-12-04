import { CofheProvider, createCofhesdkClient, createCofhesdkConfig } from '@cofhe/react';
import { useEffect, useCallback, createContext, useContext, useState } from 'react';
import { usePublicClient, useWalletClient, useConnect, useAccount, useSwitchChain, injected } from 'wagmi';
import { sepolia, baseSepolia } from '@cofhe/sdk/chains';
import { createMockWalletAndPublicClient } from './misc';

const cofheConfig = createCofhesdkConfig({
  supportedChains: [sepolia, baseSepolia],
  // useWorkers: true, // Enable Web Workers
  react: {},
});

const cofheSdkClient = createCofhesdkClient(cofheConfig);

// Context for wallet connection
interface WalletConnectionContextValue {
  connectBrowserWallet: () => Promise<void>;
  isUsingBrowserWallet: boolean;
  switchChain: (chainId: number) => Promise<void>;
}

const WalletConnectionContext = createContext<WalletConnectionContextValue | null>(null);

export const useWalletConnection = (): WalletConnectionContextValue => {
  const context = useContext(WalletConnectionContext);
  if (!context) {
    throw new Error('useWalletConnection must be used within CofheProviderLocal');
  }
  return context;
};

// Wagmi injected connector instance: dynamically connect upon clicking on a "Connect" button to avoid auto-connect
const injectedProvider = injected({ shimDisconnect: true });

const DEFAULT_CHAIN_ID = sepolia.id;
export const CofheProviderLocal = ({ children }: { children: React.ReactNode }) => {
  const walletClientResult = useWalletClient();
  const { data: walletClient } = walletClientResult;
  const publicClient = usePublicClient();
  const { connectAsync } = useConnect();
  const { isConnected: isWagmiConnected, chainId: wagmiChainId } = useAccount();
  const { switchChainAsync: wagmiSwitchChainAsync } = useSwitchChain();

  // this store is driven by wagmi if connected, otherwise manual
  const [cofheChainId, setCofheChainId] = useState<number>(DEFAULT_CHAIN_ID);

  useEffect(() => {
    if (isWagmiConnected && wagmiChainId) {
      setCofheChainId(wagmiChainId);
    }
  }, [isWagmiConnected, wagmiChainId]);

  // Connect browser wallet function
  const connectBrowserWallet = useCallback(async () => {
    try {
      // Connect via wagmi
      await connectAsync({ connector: injectedProvider, chainId: cofheConfig.supportedChains[0].id });

      // The useEffect below will handle reconnecting cofhe client when walletClient changes
    } catch (error) {
      console.error('Failed to connect browser wallet:', error);
      throw error;
    }
  }, [connectAsync]);

  // Switch chain function
  const switchChain = useCallback(
    async (chainId: number) => {
      if (!isWagmiConnected) {
        // The cofhe client will handle chain switching by re-connecting in the hook below
        setCofheChainId(chainId);
        return;
      }

      try {
        // Check if chain is already active
        if (wagmiChainId === chainId) {
          return; // Already on this chain
        }

        // Switch chain using wagmi
        await wagmiSwitchChainAsync({ chainId });

        // The useEffect below will handle reconnecting cofhe client when chainId changes
      } catch (error) {
        console.error('Failed to switch chain:', error);
        throw error;
      }
    },
    [isWagmiConnected, wagmiSwitchChainAsync, wagmiChainId],
  );

  useEffect(() => {
    function assertAndGetWagmiPair() {
      if (!walletClient) throw new Error('Wallet client is undefined');
      if (!publicClient) throw new Error('Public client is undefined');
      return { walletClient, publicClient };
    }

    async function handleCofheConnect() {
      if (cofheSdkClient.connecting) return;
      if (isWagmiConnected && !walletClient) return; // Wait for walletClient to be available

      const pairToUse = isWagmiConnected ? assertAndGetWagmiPair() : createMockWalletAndPublicClient(cofheChainId);
      await cofheSdkClient.connect(pairToUse.publicClient, pairToUse.walletClient);
    }

    handleCofheConnect();
  }, [walletClient, publicClient, isWagmiConnected, cofheChainId]);

  return (
    <WalletConnectionContext.Provider
      value={{ connectBrowserWallet, isUsingBrowserWallet: isWagmiConnected, switchChain }}
    >
      <CofheProvider cofhesdkClient={cofheSdkClient} config={cofheConfig}>
        {children}
      </CofheProvider>
    </WalletConnectionContext.Provider>
  );
};
