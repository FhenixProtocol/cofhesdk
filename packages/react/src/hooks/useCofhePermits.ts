import type { CofhesdkClient, CofhesdkClientPermits } from '@cofhe/sdk';
import { useCofheContext } from '../providers';
import { useMemo, useSyncExternalStore } from 'react';
import { NOOP_CALLBACK } from '../utils';
import { PERMIT_STORE_DEFAULTS, PermitUtils, type Permit } from '@cofhe/sdk/permits';
import { useCofheConnection } from './useCofheConnection';

const subscribeToPermitsConstructor = (client: CofhesdkClient) => (onStoreChange: () => void) => {
  return client.permits.subscribe(() => {
    onStoreChange();
  });
};

const getPermitsSnapshotConstructor = (client: CofhesdkClient) => () => client.permits.getSnapshot();

type PermitsState = ReturnType<CofhesdkClientPermits['getSnapshot']>;

const DEFAULT_SNAPSHOT_GETTER = () => PERMIT_STORE_DEFAULTS;

type UseCofhePermitsResult = {
  state: PermitsState; // whole permits store by account by chain
  // context-specific values for the current chain and current account
  activePermit?: {
    hash: string;
    permit: Permit;
    isValid: boolean;
  };
  allPermitsWithHashes: {
    hash: string;
    permit: Permit;
  }[];
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

  const { account, chainId, connected } = useCofheConnection();

  const allPermits = chainId && account ? state.permits[chainId]?.[account] : undefined;
  // active permit

  const hash = account && chainId ? state.activePermitHash[chainId]?.[account] : undefined;
  const serialized = hash && allPermits ? allPermits[hash] : undefined;

  const { permit, isValid } = useMemo(() => {
    const _permit = serialized ? PermitUtils.deserialize(serialized) : undefined;

    return { permit: _permit, isValid: _permit ? PermitUtils.isValid(_permit).valid : false };
  }, [serialized]);

  const activePermitData =
    hash && permit
      ? {
          hash,
          permit,
          isValid,
        }
      : undefined;

  const allPermitsWithHashes = useMemo(
    () =>
      allPermits
        ? Object.keys(allPermits).map((hash) => {
            const serializedPermit = allPermits[hash];
            if (!serializedPermit) throw new Error('Permit data missing');

            return {
              hash,
              permit: PermitUtils.deserialize(serializedPermit),
            };
          })
        : [],
    [allPermits]
  );

  return {
    state,
    activePermit: connected ? activePermitData : undefined,
    allPermitsWithHashes,
  };
};
