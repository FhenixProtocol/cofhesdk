import type { CofheClient } from '@cofhe/sdk';
import { useCofheContext } from '../providers';
import { useCallback, useEffect, useMemo, useReducer, useSyncExternalStore } from 'react';
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

/**
 * Re-render once `acp` has expired, so a validity computed at render catches the expiry while
 * the view stays mounted. Returns a counter to add to the memo dependencies.
 */
export function useRerenderAtExpiry(acp: ACP | undefined): number {
  const [tick, bump] = useReducer((n: number) => n + 1, 0);
  const expiration = acp?.expiration;
  useEffect(() => {
    if (expiration === undefined) return;
    const ms = expiration * 1000 - Date.now() + 1000;
    if (ms <= 0) return;
    const id = setTimeout(bump, Math.min(ms, 2_147_483_647));
    return () => clearTimeout(id);
  }, [expiration]);
  return tick;
}

/**
 * The connected account's active ACP on `chainId` — the connected chain by default. ACPs are
 * stored per chain, so a read pinned to another chain gates on THAT chain's ACP. Creating one
 * still needs the wallet on that chain (the user signs for it).
 */
export const useCofheActiveACP = (
  chainId?: number
):
  | {
      acp: ACP;
      isValid: boolean;
    }
  | undefined => {
  const connection = useCofheConnection();
  const { account, connected } = connection;
  const acpChainId = chainId ?? connection.chainId;

  const { state } = useCofheACPsStore();

  const allACPs = acpChainId && account ? state.acps[acpChainId]?.[account] : undefined;
  // active acp

  const hash = account && acpChainId ? state.activeACPHash[acpChainId]?.[account] : undefined;
  const serialized = hash && allACPs ? allACPs[hash] : undefined;

  const _acp = useMemo(() => (serialized ? ACPUtils.deserialize(serialized) : undefined), [serialized]);
  const expiryTick = useRerenderAtExpiry(_acp);

  const acpData = useMemo(() => {
    if (!_acp || !hash) return undefined;
    return {
      acp: _acp,
      isValid: ACPUtils.isValid(_acp).valid,
      hash,
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [_acp, hash, expiryTick]);

  return connected ? acpData : undefined;
};

export const useCofheActiveACPHash = (): string | undefined => {
  const activeACP = useCofheActiveACP();
  return useMemo(() => activeACP?.acp.hash, [activeACP?.acp.hash]);
};

/**
 * The connected account ACPs stored on `chainId` (the connected chain by default), optionally
 * narrowed to one `type`, e.g. `useCofheACPs({ type: 'recipient' })` for the shares the user
 * received. Empty while disconnected.
 */
export const useCofheACPs = ({ chainId, type }: { chainId?: number; type?: ACP['type'] } = {}): ACP[] => {
  const connection = useCofheConnection();
  const { account, connected } = connection;
  const acpChainId = chainId ?? connection.chainId;
  const { state } = useCofheACPsStore();
  const stored = connected && acpChainId && account ? state.acps[acpChainId]?.[account] : undefined;

  return useMemo(() => {
    if (!stored) return [];
    const acps = Object.values(stored).flatMap((serialized) => (serialized ? [ACPUtils.deserialize(serialized)] : []));
    return type ? acps.filter((acp) => acp.type === type) : acps;
  }, [stored, type]);
};

/**
 * @deprecated Use `useCofheACPs()`: the same list, the connected account ACPs on the connected
 * chain, with optional `chainId` and `type` filters.
 */
export const useCofheAllACPs = (): ACP[] => useCofheACPs();

/**
 * A stored ACP of the connected account, by hash, on `chainId` — the connected chain by default.
 */
export const useCofheACP = (hash: string, chainId?: number): ACP | undefined => {
  const connection = useCofheConnection();
  const { account, connected } = connection;
  const acpChainId = chainId ?? connection.chainId;
  const { state } = useCofheACPsStore();
  const serializedACP = connected && acpChainId && account ? state.acps[acpChainId]?.[account]?.[hash] : undefined;
  return useMemo(() => (serializedACP ? ACPUtils.deserialize(serializedACP) : undefined), [serializedACP]);
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
          throw new Error('Client, chainId, and account must be defined to remove an ACP');
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
