import { createContext, useContext, useMemo } from 'react';
import type { CofheContextValue, CofheProviderProps } from '../types/index';
import { QueryProvider } from './QueryProvider';
import { createCofhesdkClient } from '@cofhe/sdk/web';
import { FnxFloatingButtonWithProvider } from '@/components/FnxFloatingButton/FnxFloatingButton';
import { useCofheAutoConnect } from '@/hooks/useCofheAutoConnect';
import { createCofhesdkConfig, type CofhesdkConfigWithReact } from '@/config';
import { getChainById } from '@cofhe/sdk/chains';
import type { CofhesdkConfig } from '@cofhe/sdk';
import { assert } from 'ts-essentials';

const CofheContext = createContext<CofheContextValue | undefined>(undefined);

function isReactConfig(config: CofhesdkConfig): config is CofhesdkConfigWithReact {
  return (config as CofhesdkConfigWithReact).react !== undefined;
}

export function CofheProvider(props: CofheProviderProps) {
  const { children, queryClient, autoConnect } = props;

  const networkFromAutoConnectId = autoConnect?.publicClient?.chain?.id;
  const networkFromAutoConnect = networkFromAutoConnectId ? getChainById(networkFromAutoConnectId) : undefined;

  const config = useMemo(() => {
    // priority: explicit config prop > config from provided client > create default config
    if (props.config) return props.config;
    if (props.cofhesdkClient) {
      assert(isReactConfig(props.cofhesdkClient.config), 'Provided cofhesdkClient must have react config');
      return props.cofhesdkClient.config;
    }
    return createCofhesdkConfig({ supportedChains: networkFromAutoConnect ? [networkFromAutoConnect] : [] });
  }, [props.config, props.cofhesdkClient, networkFromAutoConnect]);

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
