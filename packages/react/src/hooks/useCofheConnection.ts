import { useMemo, useSyncExternalStore } from 'react';
import { CONNECT_STORE_DEFAULTS, type CofhesdkClient, type CofhesdkClientConnectionState } from '@cofhe/sdk';
import { useCofheContext } from '../providers';
import { NOOP_CALLBACK } from '../utils';

const subscribeToConnectionConstructor = (client: CofhesdkClient) => (onStoreChange: () => void) => {
  return client.subscribe(() => {
    onStoreChange();
  });
};
const getConnectionSnapshotConstructor = (client: CofhesdkClient) => () => client.getSnapshot();

const DEFAULT_SNAPSHOT_GETTER = () => CONNECT_STORE_DEFAULTS;

// sync core store
export const useCofheConnection = (): CofhesdkClientConnectionState => {
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

export const useCofhePublicClient = () => useCofheConnection().publicClient;

export const useCofheWalletClient = () => useCofheConnection().walletClient;
