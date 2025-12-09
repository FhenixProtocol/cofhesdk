import type { CofhesdkClient } from '@cofhe/sdk';
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

// type PermitsState = ReturnType<CofhesdkClientPermits['getSnapshot']>;

const DEFAULT_SNAPSHOT_GETTER = () => PERMIT_STORE_DEFAULTS;

const useCofhePermitsStore = () => {
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
  return { state, client };
};

export const useCofheActivePermit = ():
  | {
      hash: string;
      permit: Permit;
      isValid: boolean;
    }
  | undefined => {
  const { account, chainId, connected } = useCofheConnection();

  const { state } = useCofhePermitsStore();

  const allPermits = chainId && account ? state.permits[chainId]?.[account] : undefined;
  // active permit

  const hash = account && chainId ? state.activePermitHash[chainId]?.[account] : undefined;
  const serialized = hash && allPermits ? allPermits[hash] : undefined;

  const permitData = useMemo(() => {
    const _permit = serialized ? PermitUtils.deserialize(serialized) : undefined;
    if (!_permit || !hash) return undefined;
    return {
      permit: _permit,
      isValid: _permit ? PermitUtils.isValid(_permit).valid : false,
      hash,
    };
  }, [serialized, hash]);

  return connected ? permitData : undefined;
};

export const useCofheAllPermits = (): { hash: string; permit: Permit }[] => {
  const { account, chainId, connected } = useCofheConnection();

  const { state } = useCofhePermitsStore();

  const allPermits = chainId && account ? state.permits[chainId]?.[account] : undefined;

  const allPermitsWithHashes = useMemo(
    () =>
      allPermits
        ? Object.keys(allPermits)
            .filter((hash) => !!allPermits[hash])
            .map((hash) => {
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

  return connected ? allPermitsWithHashes : [];
};

export const useCofheRemovePermit = () => {
  const { account, chainId } = useCofheConnection();

  const { client } = useCofhePermitsStore();

  return useCallback(
    async (hashToRemove: string) => {
      if (!client || !chainId || !account)
        throw new Error('Client, chainId, and account must be defined to remove a permit');

      const result = await client.permits.removePermit(hashToRemove, chainId, account);
      if (result.error) throw result.error;
    },
    [client, chainId, account]
  );
};

export const useCofheSelectPermit = () => {
  const { account, chainId } = useCofheConnection();

  const { client } = useCofhePermitsStore();

  return useCallback(
    (hashToSet: string) => {
      if (!client || !chainId || !account)
        throw new Error('Client, chainId, and account must be defined to set active permit hash');
      client.permits.selectActivePermit(hashToSet, chainId, account);
    },
    [client, chainId, account]
  );
};
