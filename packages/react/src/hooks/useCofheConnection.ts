import { useMemo, useSyncExternalStore } from 'react';
import { CONNECT_STORE_DEFAULTS, type CofhesdkClient, type CofhesdkClientConnectionState } from '@cofhe/sdk';
import { useCofheContext } from '../providers';

const subscribeToConnectionConstructor = (client: CofhesdkClient) => (onStoreChange: () => void) => {
  return client.subscribe(() => {
    onStoreChange();
  });
};
const getConnectionSnapshotConstructor = (client: CofhesdkClient) => () => client.getSnapshot();

const DEFAULT_SNAPSHOT_GETTER = () => CONNECT_STORE_DEFAULTS;
const NOOP_CALLBACK = () => () => {};

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
