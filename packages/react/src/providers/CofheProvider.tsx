import { createContext, useContext, useMemo } from 'react';
import type { CofheContextValue, CofheProviderProps } from '../types/index.js';
import { QueryProvider } from './QueryProvider.js';
import { createCofhesdkClient } from '@cofhe/sdk/web';
import { FnxFloatingButtonWithProvider } from '@/components/FnxFloatingButton/FnxFloatingButton.js';
import { useCofheAutoConnect } from '@/hooks/useCofheAutoConnect.js';

const CofheContext = createContext<CofheContextValue | undefined>(undefined);

export function CofheProvider(props: CofheProviderProps) {
  const { children, config, queryClient, autoConnect } = props;

  // use provided client or create a new one out of the config
  const cofhesdkClient = useMemo(
    () => props.cofhesdkClient ?? createCofhesdkClient(config),
    [props.cofhesdkClient, config]
  );

  const contextValue: CofheContextValue = {
    client: cofhesdkClient,
    config,
  };

  return (
    <CofheContext.Provider value={contextValue}>
      <QueryProvider queryClient={queryClient}>
        <FnxFloatingButtonWithProvider>
          {autoConnect && (
            <OptionalAutoConnect walletClient={autoConnect.walletClient} publicClient={autoConnect.publicClient} />
          )}
          {children}
        </FnxFloatingButtonWithProvider>
      </QueryProvider>
    </CofheContext.Provider>
  );
}

function OptionalAutoConnect({ walletClient, publicClient }: Required<CofheProviderProps>['autoConnect']) {
  useCofheAutoConnect({ walletClient, publicClient });
  return null;
}

export function useCofheContext(): CofheContextValue {
  const context = useContext(CofheContext);
  if (context === undefined) {
    throw new Error('useCofheContext must be used within a CofheProvider');
  }
  return context;
}
