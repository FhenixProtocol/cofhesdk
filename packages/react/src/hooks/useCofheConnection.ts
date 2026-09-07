import { useMemo, useSyncExternalStore } from 'react';
import { CONNECT_STORE_DEFAULTS, type CofheClient, type CofheClientConnectionState } from '@cofhe/sdk';
import { useCofheContext } from '../providers';
import { NOOP_CALLBACK } from '../utils';

const subscribeToConnectionConstructor = (client: CofheClient) => (onStoreChange: () => void) => {
  return client.subscribe(() => {
    onStoreChange();
  });
};
const getConnectionSnapshotConstructor = (client: CofheClient) => () => client.getSnapshot();

const DEFAULT_SNAPSHOT_GETTER = () => CONNECT_STORE_DEFAULTS;

// sync core store
export const useCofheConnection = (): CofheClientConnectionState => {
  const client = useCofheContext().client;
  const { subscribeToConnection, getConnectionSnapshot } = useMemo(() => {
    return {
      subscribeToConnection: client && subscribeToConnectionConstructor(client),
      getConnectionSnapshot: client && getConnectionSnapshotConstructor(client),
    };
  }, [client]);

  return useSyncExternalStore(
    // fallback to default store and no subscription if client is not initialized yet
    subscribeToConnection || NOOP_CALLBACK,
    getConnectionSnapshot || DEFAULT_SNAPSHOT_GETTER,
    getConnectionSnapshot || undefined
  );
};

export const useCofheIsConnected = (): boolean => {
  const { connected } = useCofheConnection();
  return connected;
};

export const useCofheAccount = (): `0x${string}` | undefined => {
  const { account } = useCofheConnection();
  return account;
};

export const useCofheChainId = (): number | undefined => {
  const { chainId } = useCofheConnection();
  return chainId;
};

export const useCofheSupportedChains = () => {
  const client = useCofheContext().client;
  return client.config.supportedChains;
};

/**
 * The public client for reads. With no argument (or the connected chain id): the connected
 * client. With another chainId: the app-supplied client from CofheProvider publicClients —
 * undefined when the app supplied none, which disables the pinned read rather than silently
 * fetching the wrong chain.
 */
export const useCofhePublicClient = (chainId?: number) => {
  const connection = useCofheConnection();
  const { publicClients } = useCofheContext();
  if (chainId === undefined || chainId === connection.chainId) return connection.publicClient;
  return publicClients?.[chainId];
};

export const useCofheWalletClient = () => useCofheConnection().walletClient;
