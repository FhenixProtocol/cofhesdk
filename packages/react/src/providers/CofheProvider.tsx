import { createContext, useContext, useMemo, useState } from 'react';
import type { CofheContextValue, CofheProviderProps } from '../types/index';
import { QueryProvider, useInternalQueryClient } from './QueryProvider';
import { useDropDecryptsOfRemovedACPs } from './acpDecryptCache';
import type { CofheClient } from '@cofhe/sdk';
import { createCofheClient } from '@cofhe/sdk/web';
import { useCofheAutoConnect } from '@/hooks/useCofheAutoConnect';
import { createCofheConfig } from '@/config';
import { chains } from '@cofhe/sdk/chains';
import { assert } from 'ts-essentials';
import type { FloatingButtonPosition } from '@/components/CofheFloatingButton/types';

const CofheContext = createContext<CofheContextValue | undefined>(undefined);

export function CofheProvider(props: CofheProviderProps) {
  const { children, queryClient, publicClient, walletClient } = props;

  const config = useMemo(() => {
    assert(!(props.config && props.cofheClient), 'CofheProvider accepts either config or cofheClient, not both');

    // use an explicit config, the provided client's config, or the default config
    if (props.config) return props.config;
    if (props.cofheClient) {
      assert(props.cofheClient.config.environment === 'react', 'Provided cofheClient must have react config');
      return props.cofheClient.config;
    }
    return createCofheConfig({ supportedChains: Object.values(chains) });
  }, [props.config, props.cofheClient]);

  // use provided client or create a new one out of the config
  const cofheClient = useMemo(() => props.cofheClient ?? createCofheClient(config), [props.cofheClient, config]);

  // dynamic values
  const [position, setPosition] = useState<FloatingButtonPosition>(config.react.position);
  const [theme, setTheme] = useState(config.react.initialTheme);

  return (
    <CofheContext.Provider
      value={{
        client: cofheClient,
        transactionRenderers: props.transactionRenderers,
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
        <DropRemovedACPDecrypts client={cofheClient} />
        {children}
      </QueryProvider>
    </CofheContext.Provider>
  );
}

function AutoConnect({ walletClient, publicClient }: Pick<CofheProviderProps, 'walletClient' | 'publicClient'>) {
  useCofheAutoConnect({ walletClient, publicClient });
  return null;
}

function DropRemovedACPDecrypts({ client }: { client: CofheClient }) {
  useDropDecryptsOfRemovedACPs(client, useInternalQueryClient());
  return null;
}

export function useCofheContext(): CofheContextValue {
  const context = useContext(CofheContext);
  if (context === undefined) {
    throw new Error('useCofheContext must be used within a CofheProvider');
  }
  return context;
}
