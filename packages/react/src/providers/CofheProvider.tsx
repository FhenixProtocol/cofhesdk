import { createContext, useContext, useEffect, useMemo, useState } from 'react';
import type { CofheContextValue, CofheProviderProps } from '../types/index';
import { QueryProvider } from './QueryProvider';
import { createCofheClient } from '@cofhe/sdk/web';
import { FnxFloatingButtonWithProvider } from '@/components/FnxFloatingButton/FnxFloatingButton';
import { useCofheAutoConnect } from '@/hooks/useCofheAutoConnect';
import { createCofheConfig } from '@/config';
import { chains } from '@cofhe/sdk/chains';
import { assert } from 'ts-essentials';
import type { FloatingButtonPosition } from '@/components/FnxFloatingButton/types';
import { setReactLogger } from '@/utils/debug';

const CofheContext = createContext<CofheContextValue | undefined>(undefined);

export function CofheProvider(props: CofheProviderProps) {
  const { children, queryClient, publicClient, walletClient } = props;

  const config = useMemo(() => {
    // priority: explicit config prop > config from provided client > create default config
    if (props.config) return props.config;
    if (props.cofheClient) {
      assert(props.cofheClient.config.environment === 'react', 'Provided cofheClient must have react config');
      return props.cofheClient.config;
    }
    return createCofheConfig({ supportedChains: Object.values(chains) });
  }, [props.config, props.cofheClient]);

  useEffect(() => {
    setReactLogger(config.react.logger);
    return () => setReactLogger(undefined);
  }, [config.react.logger]);

  // use provided client or create a new one out of the config
  const cofheClient = useMemo(() => props.cofheClient ?? createCofheClient(config), [props.cofheClient, config]);

  // dynamic values
  const [position, setPosition] = useState<FloatingButtonPosition>(config.react.position);
  const [theme, setTheme] = useState(config.react.initialTheme);

  return (
    <CofheContext.Provider
      value={{
        client: cofheClient,
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
