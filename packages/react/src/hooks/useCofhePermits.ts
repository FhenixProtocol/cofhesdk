import type { CofhesdkClient, CofhesdkClientPermits } from '@cofhe/sdk';
import { useCofheContext } from '../providers';
import { useMemo, useSyncExternalStore } from 'react';
import { NOOP_CALLBACK } from '../utils';
import { PERMIT_STORE_DEFAULTS } from '@cofhe/sdk/permits';

const subscribeToPermitsConstructor = (client: CofhesdkClient) => (onStoreChange: () => void) => {
  return client.permits.subscribe(() => {
    onStoreChange();
  });
};

const getPermitsSnapshotConstructor = (client: CofhesdkClient) => () => client.permits.getSnapshot();

type PermitsState = ReturnType<CofhesdkClientPermits['getSnapshot']>;

const DEFAULT_SNAPSHOT_GETTER = () => PERMIT_STORE_DEFAULTS;

type UseCofhePermitsResult = {
  state: PermitsState;
};
// sync core store
export const useCofhePermits = (): UseCofhePermitsResult => {
  const client = useCofheContext().client;
  const { subscribeToConnection, getConnectionSnapshot } = useMemo(() => {
    return {
      subscribeToConnection: client && subscribeToPermitsConstructor(client),
      getConnectionSnapshot: client && getPermitsSnapshotConstructor(client),
    };
  }, [client]);

  const state = useSyncExternalStore(
    // fallback to default store and no subscription if client is not initialized yet
    subscribeToConnection || NOOP_CALLBACK,
    getConnectionSnapshot || DEFAULT_SNAPSHOT_GETTER,
    getConnectionSnapshot || undefined
  );

  return { state };
};
