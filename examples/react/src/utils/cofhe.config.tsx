import { CofheProvider, createCofhesdkClient, createCofhesdkConfig } from '@cofhe/react';
import { useEffect, useState, useCallback, createContext, useContext } from 'react';
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

export const CofheProviderLocal = ({ children }: { children: React.ReactNode }) => {
  const walletClientResult = useWalletClient();
  const { data: walletClient } = walletClientResult;
  const publicClient = usePublicClient();
  const { connectAsync } = useConnect();
  const { isConnected: isWagmiConnected, chainId: wagmiChainId } = useAccount();
  const { switchChain: wagmiSwitchChain } = useSwitchChain();
  const [isUsingBrowserWallet, setIsUsingBrowserWallet] = useState(false);
  const [hasExplicitlyConnected, setHasExplicitlyConnected] = useState(false);

  // Connect browser wallet function
  const connectBrowserWallet = useCallback(async () => {
    try {
      // Connect via wagmi
      await connectAsync({ connector: injectedProvider });

      // Mark that we've explicitly requested browser wallet connection
      setHasExplicitlyConnected(true);

      // The useEffect below will handle reconnecting cofhe client when walletClient changes
    } catch (error) {
      setHasExplicitlyConnected(false);
      console.error('Failed to connect browser wallet:', error);
      throw error;
    }
  }, [connectAsync]);

  // Switch chain function
  const switchChain = useCallback(
    async (chainId: number) => {
      if (!isUsingBrowserWallet || !wagmiSwitchChain) {
        // If not using browser wallet, we can't switch chains
        // The cofhe client will handle chain switching internally
        return;
      }

      try {
        // Check if chain is already active
        if (wagmiChainId === chainId) {
          return; // Already on this chain
        }

        // Switch chain using wagmi
        await wagmiSwitchChain({ chainId });

        // The useEffect below will handle reconnecting cofhe client when chainId changes
      } catch (error) {
        console.error('Failed to switch chain:', error);
        throw error;
      }
    },
    [isUsingBrowserWallet, wagmiSwitchChain, wagmiChainId],
  );

  useEffect(() => {
    async function handleCofheConnect() {
      if (cofheSdkClient.connecting) return;

      // skip this effect until walletClient is avaialble
      if (hasExplicitlyConnected && !walletClient) return;

      // Only use browser wallet if explicitly connected via button
      // Otherwise, always use internal wallet (even if wagmi auto-connected)
      const useBrowserWallet = hasExplicitlyConnected && walletClient && publicClient && isWagmiConnected;
      setIsUsingBrowserWallet(!!useBrowserWallet);

      const pairToUse = useBrowserWallet ? { walletClient, publicClient } : createMockWalletAndPublicClient();
      await cofheSdkClient.connect(pairToUse.publicClient, pairToUse.walletClient);
    }

    handleCofheConnect();
  }, [walletClient, publicClient, isWagmiConnected, hasExplicitlyConnected, wagmiChainId]);

  return (
    <WalletConnectionContext.Provider value={{ connectBrowserWallet, isUsingBrowserWallet, switchChain }}>
      <CofheProvider cofhesdkClient={cofheSdkClient} config={cofheConfig}>
        {children}
      </CofheProvider>
    </WalletConnectionContext.Provider>
  );
};
