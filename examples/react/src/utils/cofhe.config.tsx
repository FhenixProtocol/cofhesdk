import { CofheProvider, createCofhesdkClient, createCofhesdkConfig } from '@cofhe/react';
import { useEffect, useCallback, createContext, useContext, useState, useMemo } from 'react';
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
  switchChain: (chainId: number) => Promise<void> | void;
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

  const [mockWalletCofheChainId, setMockWalletCofheChainId] = useState<number>(DEFAULT_CHAIN_ID);

  // Connect browser wallet function
  const connectBrowserWallet = useCallback(async () => {
    try {
      // Connect via wagmi, force to switch to the supported chain (as it can be on unsupported, in such case this will throw an error)
      await connectAsync({ connector: injectedProvider, chainId: cofheConfig.supportedChains[0].id });

      // The useEffect below will handle reconnecting cofhe client when walletClient changes
    } catch (error) {
      console.error('Failed to connect browser wallet:', error);
      throw error;
    }
  }, [connectAsync]);

  // Switch chain function
  const switchWagmiChain = useCallback(
    async (chainId: number) => {
      // Switch chain using wagmi
      // this will will trigger cofhe re-connection in the effect below
      const chain = await wagmiSwitchChainAsync({ chainId });
      console.log('Switched wagmi chain to:', chain);
    },
    [isWagmiConnected, wagmiSwitchChainAsync, wagmiChainId],
  );

  const pairToUse = useMemo(() => {
    if (isWagmiConnected && walletClient && publicClient) {
      // if wagmi is connected, use its clients
      return { walletClient, publicClient };
    }
    // otherwise, use mock wallet and public client
    return createMockWalletAndPublicClient(mockWalletCofheChainId);
  }, [isWagmiConnected, walletClient, publicClient, mockWalletCofheChainId]);

  useEffect(() => {
    async function handleCofheConnect() {
      if (cofheSdkClient.connecting) return;

      await cofheSdkClient.connect(pairToUse.publicClient, pairToUse.walletClient);
    }

    handleCofheConnect();
  }, [pairToUse]);

  return (
    <WalletConnectionContext.Provider
      value={{
        connectBrowserWallet,
        isUsingBrowserWallet: isWagmiConnected,
        switchChain: isWagmiConnected
          ? switchWagmiChain // if connected to a wallet - request wallet change switch
          : setMockWalletCofheChainId, // for mock wallet, switching chain = changing the state, which will change pairToUse and recreate clients
      }}
    >
      <CofheProvider cofhesdkClient={cofheSdkClient} config={cofheConfig}>
        {children}
      </CofheProvider>
    </WalletConnectionContext.Provider>
  );
};
