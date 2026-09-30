import { useMemo } from 'react';
import type { Hex } from 'viem';
import type { ACP, ImportSharedACPOptions, IncomingShare, RecipientACP } from '@cofhe/sdk/acps';
import { CofheError, CofheErrorCode } from '@cofhe/sdk';
import { useInternalMutation, useInternalQuery, useInternalQueryClient } from '../../providers/index.js';
import { useCofheClient } from '../useCofheClient.js';
import { useCofheACPs } from '../useCofheACPs.js';
import { ACP_STATUS_QUERY_KEY } from '../useCofheACPScope.js';
import { useCofheAccount, useCofheChainId } from '../useCofheConnection.js';

const INCOMING_SHARES_KEY = 'cofhe-incoming-shares';
const INCOMING_SHARES_REFETCH_MS = 15_000;

type MutationCallbacks = {
  onSuccess?: () => void;
  onError?: (error: Error) => void;
};

/** Wait until the write is mined, so the next read (registry, revoker) sees it. */
async function mined(client: ReturnType<typeof useCofheClient>, hash: Hex): Promise<Hex> {
  const { publicClient } = client.getSnapshot();
  await publicClient?.waitForTransactionReceipt({ hash });
  return hash;
}

/**
 * Importable on-chain shares addressed to the connected account: unexpired, not revoked, and not
 * yet imported by this account (matched by issuer signature). Polls the share registry, resolved
 * from the chain ACL with `acp.sharingRegistry` config as an override; an empty list on chains
 * without a registry.
 */
export const useCofheIncomingShares = ({
  enabled = true,
  refetchIntervalMs = INCOMING_SHARES_REFETCH_MS,
}: { enabled?: boolean; refetchIntervalMs?: number } = {}) => {
  const cofheClient = useCofheClient();
  const account = useCofheAccount();
  const chainId = useCofheChainId();
  const received = useCofheACPs({ type: 'recipient' });

  const query = useInternalQuery<IncomingShare[]>({
    queryKey: [INCOMING_SHARES_KEY, chainId, account],
    enabled: enabled && account != null && chainId != null,
    refetchInterval: refetchIntervalMs,
    queryFn: async () => {
      try {
        return await cofheClient.acp.getIncomingShares();
      } catch (e) {
        // no registry on this chain: sharing is simply unavailable, not an error
        if (e instanceof CofheError && e.code === CofheErrorCode.MissingConfig) return [];
        throw e;
      }
    },
  });

  const data = useMemo(
    () =>
      query.data?.filter(
        (share) => !received.some((acp) => acp.issuerSignature.toLowerCase() === share.issuerSignature.toLowerCase())
      ),
    [query.data, received]
  );
  return { ...query, data } as typeof query;
};

/** Issuer side: post a signed sharing ACP to the on-chain share registry. Resolves once mined. */
export const useCofheShareOnChain = ({ onSuccess, onError }: MutationCallbacks = {}) => {
  const cofheClient = useCofheClient();

  return useInternalMutation<{ txHash: Hex; shareId: Hex }, Error, ACP>({
    onSuccess,
    onError,
    mutationFn: async (acp) => {
      const result = await cofheClient.acp.shareOnChain(acp);
      await mined(cofheClient, result.txHash);
      return result;
    },
  });
};

/**
 * Recipient side: import a share, from its exported JSON or from the on-chain registry
 * (an `IncomingShare`). Signs and stores it; `activate` (default `true`) also makes it the
 * active ACP. Pass `false` to keep the user own ACP active and use the imported one in a
 * `<CofheACPScope>`.
 */
export const useCofheImportShared = ({
  activate = true,
  onSuccess,
  onError,
}: MutationCallbacks & { activate?: boolean } = {}) => {
  const cofheClient = useCofheClient();
  const queryClient = useInternalQueryClient();

  return useInternalMutation<RecipientACP, Error, string | ImportSharedACPOptions | IncomingShare>({
    onSuccess,
    onError,
    onSettled: () => queryClient.invalidateQueries({ queryKey: [INCOMING_SHARES_KEY] }),
    mutationFn: async (input) =>
      typeof input !== 'string' && 'shareId' in input
        ? cofheClient.acp.importFromChain(input, { activate })
        : cofheClient.acp.importShared(input, { activate }),
  });
};

/**
 * Remove a share from the registry: the recipient dismisses it (after importing, or to decline),
 * the issuer retracts a pending one. Resolves once mined.
 */
export const useCofheRemoveShare = ({ onSuccess, onError }: MutationCallbacks = {}) => {
  const cofheClient = useCofheClient();
  const queryClient = useInternalQueryClient();

  return useInternalMutation<Hex, Error, Hex>({
    onSuccess,
    onError,
    onSettled: () => queryClient.invalidateQueries({ queryKey: [INCOMING_SHARES_KEY] }),
    mutationFn: async (shareId) => mined(cofheClient, await cofheClient.acp.dismissShare(shareId)),
  });
};

/**
 * Issuer side: revoke an ACP through its revoker contract. Resolves once mined, then the ACP
 * on-chain status (`useCofheACPStatus`, `<CofheACPScope>`) re-reads as revoked.
 */
export const useCofheRevokeACP = ({ onSuccess, onError }: MutationCallbacks = {}) => {
  const cofheClient = useCofheClient();
  const queryClient = useInternalQueryClient();

  return useInternalMutation<Hex, Error, ACP>({
    onSuccess,
    onError,
    onSettled: (_data, _error, acp) => queryClient.invalidateQueries({ queryKey: [ACP_STATUS_QUERY_KEY, acp.hash] }),
    mutationFn: async (acp) => mined(cofheClient, await cofheClient.acp.revokeACP(acp)),
  });
};

// Names used inside this package before the hooks were exported.
/** @deprecated Use `useCofheIncomingShares`. */
export const useIncomingShares = () => useCofheIncomingShares();
/** @deprecated Use `useCofheShareOnChain`. */
export const useShareOnChain = useCofheShareOnChain;
/** @deprecated Use `useCofheImportShared` (which also takes `activate`). */
export const useImportFromChain = (callbacks: MutationCallbacks = {}) => useCofheImportShared(callbacks);
/** @deprecated Use `useCofheRemoveShare`. */
export const useRemoveShare = useCofheRemoveShare;
