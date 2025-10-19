import { createContext, useContext, useEffect, useState } from 'react';
import type { CofhesdkClient } from 'cofhesdk';
import type { CofheContextValue, CofheProviderProps } from '../types/index.js';

const CofheContext = createContext<CofheContextValue | undefined>(undefined);

export function CofheProvider({ children, client: providedClient, config }: CofheProviderProps) {
  const [client, setClient] = useState<CofhesdkClient | null>(providedClient || null);
  const [isInitialized, setIsInitialized] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    if (providedClient) {
      setClient(providedClient);
      setIsInitialized(true);
      return;
    }

    if (config) {
      try {
        // Initialize client with config
        // This would need to be implemented based on the actual CofheClient constructor
        // const newClient = new CofheClient(config);
        // setClient(newClient);
        setIsInitialized(true);
      } catch (err) {
        setError(err instanceof Error ? err : new Error('Failed to initialize CoFHE client'));
      }
    }
  }, [providedClient, config]);

  const contextValue: CofheContextValue = {
    client,
    isInitialized,
    error,
  };

  return (
    <CofheContext.Provider value={contextValue}>
      {children}
    </CofheContext.Provider>
  );
}

export function useCofheContext(): CofheContextValue {
  const context = useContext(CofheContext);
  if (context === undefined) {
    throw new Error('useCofheContext must be used within a CofheProvider');
  }
  return context;
}
