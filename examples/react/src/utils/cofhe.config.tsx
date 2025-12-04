import { CofheProvider, createCofhesdkClient, createCofhesdkConfig } from '@cofhe/react';
import { useEffect, useState, useCallback, createContext, useContext } from 'react';
import { usePublicClient, useWalletClient, useConnect, useAccount, useSwitchChain } from 'wagmi';
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

export const CofheProviderLocal = ({ children }: { children: React.ReactNode }) => {
  const walletClientResult = useWalletClient();
  const { data: walletClient } = walletClientResult;
  const publicClient = usePublicClient();
  const { connect, connectors } = useConnect();
  const { isConnected: isWagmiConnected, chainId: wagmiChainId } = useAccount();
  const { switchChain: wagmiSwitchChain } = useSwitchChain();
  const [isUsingBrowserWallet, setIsUsingBrowserWallet] = useState(false);
  const [hasExplicitlyConnected, setHasExplicitlyConnected] = useState(false);

  // Connect browser wallet function
  const connectBrowserWallet = useCallback(async () => {
    try {
      // Find injected connector (MetaMask, etc.)
      const injectedConnector = connectors.find((c) => c.id === 'injected' || c.type === 'injected');
      const connectorToUse = injectedConnector || connectors[0];

      if (!connectorToUse) {
        throw new Error('No wallet connector available');
      }

      // Mark that we've explicitly requested browser wallet connection
      setHasExplicitlyConnected(true);

      // Connect via wagmi
      await connect({ connector: connectorToUse });

      // The useEffect below will handle reconnecting cofhe client when walletClient changes
    } catch (error) {
      console.error('Failed to connect browser wallet:', error);
      throw error;
    }
  }, [connect, connectors]);

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
    async function handleConnect() {
      if (cofheSdkClient.connecting) return;

      // Only use browser wallet if explicitly connected via button
      // Otherwise, always use internal wallet (even if wagmi auto-connected)
      const useBrowserWallet = hasExplicitlyConnected && walletClient && publicClient && isWagmiConnected;
      setIsUsingBrowserWallet(!!useBrowserWallet);

      // Get current connection state
      const currentSnapshot = cofheSdkClient.getSnapshot();

      // If already connected, check if we need to reconnect
      if (currentSnapshot.connected) {
        if (useBrowserWallet && walletClient && publicClient) {
          // Check if account and chainId match
          try {
            const addresses = await walletClient.getAddresses();
            const currentAccount = addresses[0];
            const currentChainId = await publicClient.getChainId();

            if (currentAccount === currentSnapshot.account && currentChainId === currentSnapshot.chainId) {
              return; // Already connected with same browser wallet and chain
            }
          } catch {
            // If we can't get addresses or chainId, reconnect
          }
        } else if (!useBrowserWallet) {
          // Using internal wallet - if already connected with internal, don't reconnect
          // We'll reconnect if switching from browser to internal
          if (!hasExplicitlyConnected) {
            // Still using internal, check if we need to reconnect
            // Only reconnect if not connected yet
            if (currentSnapshot.connected) {
              return; // Already connected with internal wallet
            }
          }
        }
      }

      const pairToUse = useBrowserWallet ? { walletClient, publicClient } : createMockWalletAndPublicClient();

      await cofheSdkClient.connect(pairToUse.publicClient, pairToUse.walletClient);
    }
    handleConnect();
  }, [walletClient, publicClient, isWagmiConnected, hasExplicitlyConnected, wagmiChainId]);

  return (
    <WalletConnectionContext.Provider value={{ connectBrowserWallet, isUsingBrowserWallet, switchChain }}>
      <CofheProvider cofhesdkClient={cofheSdkClient} config={cofheConfig}>
        {children}
      </CofheProvider>
    </WalletConnectionContext.Provider>
  );
};
