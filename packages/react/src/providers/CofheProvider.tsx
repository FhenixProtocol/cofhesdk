import { createContext, useContext, useMemo } from 'react';
import type { CofheContextValue, CofheProviderProps } from '../types/index.js';
import { QueryProvider } from './QueryProvider.js';
import { createCofhesdkClient } from '@cofhe/sdk/web';
import { ErrorBoundary, type FallbackProps } from 'react-error-boundary';

const CofheContext = createContext<CofheContextValue | undefined>(undefined);

const Fallback: React.FC<FallbackProps> = () => {
  // only whitelisted errors will reach here (refer to `shouldPassToErrorBoundary`)
  // f.x. if it's Permit error - redirect to Permit Creation screen
  return <div>TODO: redirect to error screen</div>;
};

export function CofheProvider(props: CofheProviderProps) {
  const { children, config, queryClient } = props;

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
    <ErrorBoundary
      FallbackComponent={Fallback}
      onError={(error, info) => {
        // Centralized logging without rendering a fallback UI
        console.error('[cofhesdk][ErrorBoundary] error:', error, info);
      }}
    >
      <CofheContext.Provider value={contextValue}>
        <QueryProvider queryClient={queryClient}>{children}</QueryProvider>
      </CofheContext.Provider>
    </ErrorBoundary>
  );
}

export function useCofheContext(): CofheContextValue {
  const context = useContext(CofheContext);
  if (context === undefined) {
    throw new Error('useCofheContext must be used within a CofheProvider');
  }
  return context;
}
