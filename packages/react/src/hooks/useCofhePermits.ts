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

export const useCofheActivePermitHash = (): string | undefined => {
  const activePermit = useCofheActivePermit();
  return useMemo(() => activePermit?.permit.hash, [activePermit?.permit.hash]);
};

export const useCofheAllPermits = (): Permit[] => {
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

              return PermitUtils.deserialize(serializedPermit);
            })
        : [],
    [allPermits]
  );

  return connected ? allPermitsWithHashes : [];
};

export const useCofhePermit = (hash: string): Permit | undefined => {
  const { account, chainId, connected } = useCofheConnection();
  const { state } = useCofhePermitsStore();
  return useMemo(() => {
    if (!connected || !chainId || !account) return undefined;
    const serializedPermit = state.permits[chainId]?.[account]?.[hash];
    if (!serializedPermit) return undefined;
    return PermitUtils.deserialize(serializedPermit);
  }, [connected, chainId, account, hash, state.permits]);
};

type Callbacks = {
  onSuccess?: () => void;
  onError?: (error: Error) => void;
};

export const useCofheRemovePermit = ({ onSuccess, onError }: Callbacks = {}) => {
  const { account, chainId } = useCofheConnection();
  const { client } = useCofhePermitsStore();

  return useCallback(
    async (hashToRemove: string) => {
      try {
        if (!client || !chainId || !account) {
          throw new Error('Client, chainId, and account must be defined to remove a permit');
        }

        client.permits.removePermit(hashToRemove, chainId, account, true);
        onSuccess?.();
      } catch (error) {
        onError?.(new Error(error instanceof Error ? error.message : 'Unknown error'));
      }
    },
    [client, chainId, account, onSuccess, onError]
  );
};

export const useCofheSelectPermit = ({ onSuccess, onError }: Callbacks = {}) => {
  const { account, chainId } = useCofheConnection();
  const { client } = useCofhePermitsStore();

  return useCallback(
    (hashToSet: string) => {
      try {
        if (!client || !chainId || !account) {
          throw new Error('Client, chainId, and account must be defined to set active permit hash');
        }
        client.permits.selectActivePermit(hashToSet, chainId, account);
        onSuccess?.();
      } catch (error) {
        onError?.(new Error(error instanceof Error ? error.message : 'Unknown error'));
      }
    },
    [client, chainId, account, onSuccess, onError]
  );
};
