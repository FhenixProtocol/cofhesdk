import { createContext, useContext, useMemo } from 'react';
import type { CofheContextValue, CofheProviderProps } from '../types/index.js';
import { QueryProvider } from './QueryProvider.js';
import { createCofhesdkClient } from '@cofhe/sdk/web';

const CofheContext = createContext<CofheContextValue | undefined>(undefined);

export function CofheProvider(props: CofheProviderProps) {
  const { children, config, queryClient } = props;

  // use provided client or create a new one out of the config
  const client = useMemo(() => props.client ?? createCofhesdkClient(config), [props.client, config]);

  const contextValue: CofheContextValue = {
    client,
    config,
  };

  return (
    <CofheContext.Provider value={contextValue}>
      <QueryProvider queryClient={queryClient}>{children}</QueryProvider>
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
