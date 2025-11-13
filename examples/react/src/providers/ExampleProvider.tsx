// this context & provider unused currently but may be used in the future
import React, { createContext, useContext, useEffect, useState } from 'react';
import { createCofhesdkClient, createCofhesdkConfig } from '@cofhe/sdk/web';
import { sepolia as cofheSepoliaChain } from '@cofhe/sdk/chains';
import { CofheProvider } from '@cofhe/react';
import type { CofhesdkClient } from '@cofhe/sdk';
import { createMockWalletAndPublicClient } from '../utils/misc';

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
      const { walletClient, publicClient } = createMockWalletAndPublicClient();

      // Create CoFHE SDK configuration
      const inputConfig = {
        supportedChains: [cofheSepoliaChain],
      };

      const config = createCofhesdkConfig(inputConfig);

      // Create CoFHE SDK client
      const cofheClient = createCofhesdkClient(config);
      // Connect the client
      const connectResult = await cofheClient.connect(publicClient, walletClient);
      console.log('--------------------------------');
      console.log('connectResult', connectResult);
      console.log('--------------------------------');

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
      <CofheProvider client={client || undefined}>{children}</CofheProvider>
    </ExampleContext.Provider>
  );
};
