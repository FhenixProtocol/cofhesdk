import type { CofhesdkClient, CofhesdkClientPermits } from '@cofhe/sdk';
import { useCofheContext } from '../providers';
import { useCallback, useMemo, useSyncExternalStore } from 'react';
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

  // eslint-disable-next-line no-unused-vars
  removePermit: (hashToRemove: string) => void;
  // eslint-disable-next-line no-unused-vars
  setActivePermitHash: (hashToSet: string) => void;
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

  const removePermit = useCallback(
    (hashToRemove: string) => {
      if (!client || !chainId || !account)
        throw new Error('Client, chainId, and account must be defined to remove a permit');
      client.permits.removePermit(hashToRemove, chainId, account);
    },
    [client, chainId, account]
  );

  const setActivePermitHash = useCallback(
    (hashToSet: string) => {
      if (!client || !chainId || !account)
        throw new Error('Client, chainId, and account must be defined to set active permit hash');
      client.permits.selectActivePermit(hashToSet, chainId, account);
    },
    [client, chainId, account]
  );

  return {
    state,
    activePermit: connected ? activePermitData : undefined,
    allPermitsWithHashes,
    removePermit,
    setActivePermitHash,
  };
};
