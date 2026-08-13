import type { CofheClient } from '@cofhe/sdk';
import { useCofheContext } from '../providers';
import { useCallback, useMemo, useSyncExternalStore } from 'react';
import { NOOP_CALLBACK } from '../utils';
import { ACP_STORE_DEFAULTS, ACPUtils, type ACP } from '@cofhe/sdk/acps';
import { useCofheConnection } from './useCofheConnection';

const subscribeToACPsConstructor = (client: CofheClient) => (onStoreChange: () => void) => {
  return client.acp.subscribe(() => {
    onStoreChange();
  });
};

const getACPsSnapshotConstructor = (client: CofheClient) => () => client.acp.getSnapshot();

// type ACPsState = ReturnType<CofheClientACPs['getSnapshot']>;

const DEFAULT_SNAPSHOT_GETTER = () => ACP_STORE_DEFAULTS;

const useCofheACPsStore = () => {
  const client = useCofheContext().client;
  const { subscribeToConnection, getConnectionSnapshot } = useMemo(() => {
    return {
      subscribeToConnection: client && subscribeToACPsConstructor(client),
      getConnectionSnapshot: client && getACPsSnapshotConstructor(client),
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

export const useCofheActiveACP = ():
  | {
      acp: ACP;
      isValid: boolean;
    }
  | undefined => {
  const { account, chainId, connected } = useCofheConnection();

  const { state } = useCofheACPsStore();

  const allACPs = chainId && account ? state.acps[chainId]?.[account] : undefined;
  // active acp

  const hash = account && chainId ? state.activeACPHash[chainId]?.[account] : undefined;
  const serialized = hash && allACPs ? allACPs[hash] : undefined;

  const acpData = useMemo(() => {
    const _acp = serialized ? ACPUtils.deserialize(serialized) : undefined;
    if (!_acp || !hash) return undefined;
    return {
      acp: _acp,
      isValid: _acp ? ACPUtils.isValid(_acp).valid : false,
      hash,
    };
  }, [serialized, hash]);

  return connected ? acpData : undefined;
};

export const useCofheActiveACPHash = (): string | undefined => {
  const activeACP = useCofheActiveACP();
  return useMemo(() => activeACP?.acp.hash, [activeACP?.acp.hash]);
};

export const useCofheAllACPs = (): ACP[] => {
  const { account, chainId, connected } = useCofheConnection();

  const { state } = useCofheACPsStore();

  const allACPs = chainId && account ? state.acps[chainId]?.[account] : undefined;

  const allACPsWithHashes = useMemo(
    () =>
      allACPs
        ? Object.keys(allACPs)
            .filter((hash) => !!allACPs[hash])
            .map((hash) => {
              const serializedACP = allACPs[hash];
              if (!serializedACP) throw new Error('ACP data missing');

              return ACPUtils.deserialize(serializedACP);
            })
        : [],
    [allACPs]
  );

  return connected ? allACPsWithHashes : [];
};

export const useCofheACP = (hash: string): ACP | undefined => {
  const { account, chainId, connected } = useCofheConnection();
  const { state } = useCofheACPsStore();
  return useMemo(() => {
    if (!connected || !chainId || !account) return undefined;
    const serializedACP = state.acps[chainId]?.[account]?.[hash];
    if (!serializedACP) return undefined;
    return ACPUtils.deserialize(serializedACP);
  }, [connected, chainId, account, hash, state.acps]);
};

type Callbacks = {
  onSuccess?: () => void;
  onError?: (error: Error) => void;
};

export const useCofheRemoveACP = ({ onSuccess, onError }: Callbacks = {}) => {
  const { account, chainId } = useCofheConnection();
  const { client } = useCofheACPsStore();

  return useCallback(
    async (hashToRemove: string) => {
      try {
        if (!client || !chainId || !account) {
          throw new Error('Client, chainId, and account must be defined to remove a acp');
        }

        client.acp.removeACP(hashToRemove, chainId, account);
        onSuccess?.();
      } catch (error) {
        onError?.(new Error(error instanceof Error ? error.message : 'Unknown error'));
      }
    },
    [client, chainId, account, onSuccess, onError]
  );
};

export const useCofheSelectACP = ({ onSuccess, onError }: Callbacks = {}) => {
  const { account, chainId } = useCofheConnection();
  const { client } = useCofheACPsStore();

  return useCallback(
    (hashToSet: string) => {
      try {
        if (!client || !chainId || !account) {
          throw new Error('Client, chainId, and account must be defined to set active acp hash');
        }
        client.acp.selectActiveACP(hashToSet, chainId, account);
        onSuccess?.();
      } catch (error) {
        onError?.(new Error(error instanceof Error ? error.message : 'Unknown error'));
      }
    },
    [client, chainId, account, onSuccess, onError]
  );
};
