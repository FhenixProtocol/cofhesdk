import React, { createContext, useContext, useEffect, useState } from 'react';
import { createCofhesdkClient, createCofhesdkConfig } from 'cofhesdk/web';
import { createPublicClient, createWalletClient, http } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { sepolia } from 'viem/chains';
import { sepolia as cofheSepoliaChain } from 'cofhesdk/chains';
import { CofheProvider } from '@cofhesdk/react';
import type { CofhesdkClient } from 'cofhesdk';

interface ExampleContextType {
  isInitialized: boolean;
  isInitializing: boolean;
  error: string | null;
  client: CofhesdkClient | null;
  initialize: () => Promise<void>;
}

const ExampleContext = createContext<ExampleContextType | null>(null);

export const useExample = () => {
  const context = useContext(ExampleContext);
  if (!context) {
    throw new Error('useExample must be used within ExampleProvider');
  }
  return context;
};

interface ExampleProviderProps {
  children: React.ReactNode;
}

export const ExampleProvider: React.FC<ExampleProviderProps> = ({ children }) => {
  const [isInitialized, setIsInitialized] = useState(false);
  const [isInitializing, setIsInitializing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [client, setClient] = useState<CofhesdkClient | null>(null);

  // Auto-initialize on mount
  useEffect(() => {
    initialize();
  }, []);

  const initialize = async () => {
    if (isInitialized || isInitializing) return;
    
    setIsInitializing(true);
    setError(null);

    try {
      // Create a mock private key for examples (DO NOT use in production)
      const mockPrivateKey = '0x1234567890123456789012345678901234567890123456789012345678901234';
      const account = privateKeyToAccount(mockPrivateKey);
      
      // Create public client (provider) for Sepolia
      const publicClient = createPublicClient({
        chain: sepolia,
        transport: http('https://sepolia.gateway.tenderly.co'), // Public Sepolia RPC
      });

      // Create wallet client (signer) for Sepolia
      const walletClient = createWalletClient({
        account,
        chain: sepolia,
        transport: http('https://sepolia.gateway.tenderly.co'),
      });

      // Create CoFHE SDK configuration
      const inputConfig = {
        supportedChains: [cofheSepoliaChain],
      };
  
      const config = createCofhesdkConfig(inputConfig);

      // Create CoFHE SDK client
      const cofheClient = createCofhesdkClient(config);
      // Connect the client
      const connectResult = await cofheClient.connect(publicClient, walletClient);
      console.log("--------------------------------")
      console.log('connectResult', connectResult);
      console.log("--------------------------------")
      
      if (!connectResult.success) {
        throw connectResult.error;
      }

      console.log('CoFHE SDK initialized successfully:', cofheClient);
      setClient(cofheClient);
      setIsInitialized(true);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error';
      console.error('Failed to initialize CoFHE SDK:', errorMessage);
      setError(errorMessage);
    } finally {
      setIsInitializing(false);
    }
  };

  const value: ExampleContextType = {
    isInitialized,
    isInitializing,
    error,
    client,
    initialize,
  };

  return (
    <ExampleContext.Provider value={value}>
      <CofheProvider client={client}>
        {children}
      </CofheProvider>
    </ExampleContext.Provider>
  );
};
