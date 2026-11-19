import type { CofheClient } from '@cofhe/sdk';
import { useCofheContext } from '../providers';
import { useCallback, useEffect, useMemo, useState, useSyncExternalStore } from 'react';
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

/** The local clock in unix seconds, the unit ACP expirations use. */
const nowSec = () => Math.floor(Date.now() / 1000);

/**
 * The time to check `acp`'s expiry against during render, in unix seconds.
 *
 * Why: whether an ACP has expired depends on the clock, and React does not re-render when the
 * clock moves. A memo like `useMemo(() => ACPUtils.isValid(acp, now), [acp, now])` only flips to
 * invalid if `now` changes at the right moment. This hook returns such a `now` and changes it
 * exactly when the answer can change:
 *
 * 1. When the expiration changes (another ACP, or none), right away in the same render. A time
 *    kept from an earlier ACP may be long past, and checking the new ACP against it could call an
 *    already-expired ACP valid.
 * 2. One second after the expiration, from a timer, so a view that stays mounted sees the ACP turn
 *    invalid. The extra second keeps the new time strictly past the expiration.
 *
 * Between those moments it returns the same number, so the memo above does not recompute on every
 * render. Same local clock as `ACPUtils.isValid(acp)` with no time argument.
 */
export function useNowAtExpiry(acp: ACP | undefined): number {
  const expiration = acp?.expiration;

  // The time last taken, and which expiration it was taken for.
  const [clock, setClock] = useState(() => ({ expiration, nowSec: nowSec() }));

  // Case 1: the expiration changed since the time was taken, so that time is stale. Setting state
  // during render is React's pattern for adjusting state when an input changes: React discards
  // this render's output and renders again with the new state before showing anything. This
  // render still returns a fresh time below, so nothing is computed from the stale one.
  const stale = clock.expiration !== expiration;
  if (stale) setClock({ expiration, nowSec: nowSec() });

  // Case 2: take the time again one second after the expiration. Restarts whenever the expiration
  // changes; the cleanup cancels the timer of the previous ACP.
  useEffect(() => {
    if (expiration === undefined) return; // no ACP: nothing to expire
    const ms = expiration * 1000 - Date.now() + 1000;
    if (ms <= 0) return; // already expired: the time taken in case 1 is already past it
    // setTimeout overflows above 2^31 - 1 ms (about 24.8 days) and would fire at once; cap it.
    // A capped timer fires early, takes a time that is still before the expiration, and since the
    // expiration did not change, nothing re-arms it. Expirations that far out are not expected
    // to flip while one view stays open.
    const id = setTimeout(() => setClock({ expiration, nowSec: nowSec() }), Math.min(ms, 2_147_483_647));
    return () => clearTimeout(id);
  }, [expiration]);

  return stale ? nowSec() : clock.nowSec;
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
  const now = useNowAtExpiry(_acp);

  const acpData = useMemo(() => {
    if (!_acp || !hash) return undefined;
    return {
      acp: _acp,
      isValid: ACPUtils.isValid(_acp, now).valid,
      hash,
    };
  }, [_acp, hash, now]);

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
