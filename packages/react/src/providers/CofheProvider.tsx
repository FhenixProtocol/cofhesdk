import { createContext, useContext, useMemo, useState } from 'react';
import type { CofheContextValue, CofheProviderProps } from '../types/index';
import { QueryProvider } from './QueryProvider';
import { createCofhesdkClient } from '@cofhe/sdk/web';
import { FnxFloatingButtonWithProvider } from '@/components/FnxFloatingButton/FnxFloatingButton';
import { useCofheAutoConnect } from '@/hooks/useCofheAutoConnect';
import { createCofhesdkConfig, type CofhesdkConfigWithReact } from '@/config';
import { getChainById } from '@cofhe/sdk/chains';
import type { CofhesdkConfig } from '@cofhe/sdk';
import { assert } from 'ts-essentials';
import type { FloatingButtonPosition } from '@/components/FnxFloatingButton/types';

const CofheContext = createContext<CofheContextValue | undefined>(undefined);

function isReactConfig(config: CofhesdkConfig): config is CofhesdkConfigWithReact {
  return Object.prototype.hasOwnProperty.call(config, 'react');
}

export function CofheProvider(props: CofheProviderProps) {
  const { children, queryClient, publicClient, walletClient } = props;

  const networkFromAutoConnectId = publicClient?.chain?.id;
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

  // dynamic values
  const [position, setPosition] = useState<FloatingButtonPosition>(config.react.position);
  const [theme, setTheme] = useState(config.react.initialTheme);

  return (
    <CofheContext.Provider
      value={{
        client: cofhesdkClient,
        state: {
          position,
          setPosition,
          theme,
          setTheme,
        },
      }}
    >
      <QueryProvider queryClient={queryClient}>
        <AutoConnect walletClient={walletClient} publicClient={publicClient} />
        <FnxFloatingButtonWithProvider>{children}</FnxFloatingButtonWithProvider>
      </QueryProvider>
    </CofheContext.Provider>
  );
}

function AutoConnect({ walletClient, publicClient }: Pick<CofheProviderProps, 'walletClient' | 'publicClient'>) {
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
