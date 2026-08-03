import type { ACP, IncomingShare } from '@cofhe/sdk/permits';
import { useInternalMutation, useInternalQuery, useInternalQueryClient } from '../../providers/index.js';
import { useCofheClient } from '../useCofheClient.js';
import { useCofheAccount, useCofheChainId } from '../useCofheConnection.js';

const INCOMING_SHARES_KEY = 'cofhe-incoming-shares';
const INCOMING_SHARES_REFETCH_MS = 15_000;

/**
 * Importable on-chain shares addressed to the connected account (unexpired,
 * not revoked). Polls the share registry; disabled when no registry is
 * configured for the connected chain (`permit.sharingRegistry`).
 */
export const useIncomingShares = () => {
  const cofheClient = useCofheClient();
  const account = useCofheAccount();
  const chainId = useCofheChainId();

  const registryConfigured = chainId != null && cofheClient.config.permit?.sharingRegistry?.[chainId] != null;

  return useInternalQuery<IncomingShare[]>({
    queryKey: [INCOMING_SHARES_KEY, chainId, account],
    enabled: account != null && registryConfigured,
    refetchInterval: INCOMING_SHARES_REFETCH_MS,
    queryFn: () => cofheClient.acp.getIncomingShares(),
  });
};

type MutationCallbacks = {
  onSuccess?: () => void;
  onError?: (error: Error) => void;
};

/** Issuer-side: post a signed sharing ACP to the on-chain share registry. */
export const useShareOnChain = ({ onSuccess, onError }: MutationCallbacks = {}) => {
  const cofheClient = useCofheClient();

  return useInternalMutation<{ txHash: `0x${string}`; shareId: `0x${string}` }, Error, ACP>({
    onSuccess,
    onError,
    mutationFn: async (permit) => cofheClient.acp.shareOnChain(permit),
  });
};

/** Recipient-side: import a discovered share (signs, stores, activates). */
export const useImportFromChain = ({ onSuccess, onError }: MutationCallbacks = {}) => {
  const cofheClient = useCofheClient();
  const queryClient = useInternalQueryClient();

  return useInternalMutation<void, Error, IncomingShare>({
    onSuccess,
    onError,
    onSettled: () => queryClient.invalidateQueries({ queryKey: [INCOMING_SHARES_KEY] }),
    mutationFn: async (share) => {
      await cofheClient.acp.importFromChain(share);
    },
  });
};

/**
 * Remove a share from the registry: the recipient dismisses it (after import,
 * or to decline) — the issuer retracts a pending one.
 */
export const useRemoveShare = ({ onSuccess, onError }: MutationCallbacks = {}) => {
  const cofheClient = useCofheClient();
  const queryClient = useInternalQueryClient();

  return useInternalMutation<void, Error, `0x${string}`>({
    onSuccess,
    onError,
    onSettled: () => queryClient.invalidateQueries({ queryKey: [INCOMING_SHARES_KEY] }),
    mutationFn: async (shareId) => {
      await cofheClient.acp.dismissShare(shareId);
    },
  });
};
