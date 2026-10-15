import { useCallback, useRef } from 'react';
import type { Abi, ContractFunctionArgs, ContractFunctionName, Hex } from 'viem';
import type { ACP, ImportSharedACPOptions, IncomingShare, RecipientACP, ShareLabel } from '@cofhe/sdk/acps';
import { CofheError, CofheErrorCode } from '@cofhe/sdk';
import { useInternalMutation, useInternalQuery, useInternalQueryClient } from '../../providers/index.js';
import { useCofheClient } from '../useCofheClient.js';
import { useCofheACPs } from '../useCofheACPs.js';
import { ACP_STATUS_QUERY_KEY } from '../useCofheACPScope.js';
import { useCofheAccount, useCofheChainId } from '../useCofheConnection.js';
import {
  useCofheWriteContract,
  type CofheWriteInvalidationTarget,
  type WalletWriteContractParams,
} from '../useCofheWriteContract';
import { useTransactionGlobalLifecycle } from '../useTransactionGlobalLifecycle';
import {
  TransactionActionType,
  useTransactionStore,
  type BuiltInTransactionActionType,
  type JsonValue,
} from '../../stores/transactionStore';

const INCOMING_SHARES_KEY = 'cofhe-incoming-shares';
const INCOMING_SHARES_REFETCH_MS = 15_000;

/** What a share is posted with: its labels, or an already encoded metadata blob. */
type ShareOnChainOptions = { labels?: readonly ShareLabel[]; metadata?: Hex };

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

/** What the transaction store keeps of a sharing write besides its hash: the row's text and data. */
type SharingEntry = { description: string; payload: JsonValue };

/**
 * The path every sharing write takes: the SDK's write hook — simulated before it is sent, its
 * `invalidates` refetched block-awarely once mined — a transaction-store entry, so the write shows
 * in the floating button's Activity and the pending-transaction tracker follows it, and a wait until
 * it is mined, so a read that follows sees the result. A refused write (a simulation revert, a wallet
 * rejection) raises the submit-error toast and throws; nothing is recorded.
 */
function useSharingWrite(
  actionType: BuiltInTransactionActionType,
  invalidates: () => readonly CofheWriteInvalidationTarget[]
) {
  const cofheClient = useCofheClient();
  const account = useCofheAccount();
  const chainId = useCofheChainId();
  const { onTransactionSubmitError } = useTransactionGlobalLifecycle();
  // A ref, so the write hook's receipt callback reads the targets of the write that mined.
  const invalidatesRef = useRef(invalidates);
  invalidatesRef.current = invalidates;
  const { writeContractAsync } = useCofheWriteContract({ invalidates: () => invalidatesRef.current() });

  return useCallback(
    async <
      TAbi extends Abi | readonly unknown[],
      TFunctionName extends ContractFunctionName<TAbi, 'payable' | 'nonpayable'>,
      TArgs extends ContractFunctionArgs<TAbi, 'payable' | 'nonpayable', TFunctionName>,
    >(
      write: WalletWriteContractParams<TAbi, TFunctionName, TArgs>,
      entry: SharingEntry
    ): Promise<Hex> => {
      let hash: Hex;
      try {
        hash = await writeContractAsync(write);
      } catch (error) {
        onTransactionSubmitError(error, actionType);
        throw error;
      }
      if (account != null && chainId != null) {
        useTransactionStore.getState().addTransaction({ hash, chainId, account, actionType, ...entry });
      }
      return mined(cofheClient, hash);
    },
    [writeContractAsync, onTransactionSubmitError, actionType, account, chainId, cofheClient]
  );
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

  // Leave out shares this account already imported. Filtering in `select` (rather than copying the
  // result) keeps react-query's tracked properties: consumers re-render only on what they read.
  const select = useCallback(
    (shares: IncomingShare[]) =>
      shares.filter(
        (share) => !received.some((acp) => acp.issuerSignature.toLowerCase() === share.issuerSignature.toLowerCase())
      ),
    [received]
  );

  return useInternalQuery<IncomingShare[]>({
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
    select,
  });
};

/**
 * Issuer side: post a signed sharing ACP to the on-chain share registry, optionally with the labels
 * of its handles (`{ acp, labels }`, one label per handle). Simulated first, recorded in the
 * transaction store, resolves once mined; the registry reads and the inbox refetch then.
 */
export const useCofheShareOnChain = ({ onSuccess, onError }: MutationCallbacks = {}) => {
  const cofheClient = useCofheClient();
  const registry = useRef<Hex | undefined>(undefined);
  const send = useSharingWrite(TransactionActionType.ShareACP, () => [
    ...(registry.current ? [{ address: registry.current }] : []),
    [INCOMING_SHARES_KEY],
  ]);

  return useInternalMutation<{ txHash: Hex; shareId: Hex }, Error, ACP | ({ acp: ACP } & ShareOnChainOptions)>({
    onSuccess,
    onError,
    mutationFn: async (input) => {
      const { acp, ...options } = 'acp' in input ? input : { acp: input };
      const { write, shareId } = await cofheClient.acp.prepareShareOnChain(acp, options);
      registry.current = write.address;
      const txHash = await send(write, {
        description: `${acp.name} → ${acp.recipient}`,
        payload: { acpHash: acp.hash, shareId, recipient: acp.recipient },
      });
      return { txHash, shareId };
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
 * the issuer retracts a pending one. Simulated first, recorded in the transaction store, resolves
 * once mined; the registry reads and the inbox refetch then.
 */
export const useCofheRemoveShare = ({ onSuccess, onError }: MutationCallbacks = {}) => {
  const cofheClient = useCofheClient();
  const registry = useRef<Hex | undefined>(undefined);
  const send = useSharingWrite(TransactionActionType.RemoveShare, () => [
    ...(registry.current ? [{ address: registry.current }] : []),
    [INCOMING_SHARES_KEY],
  ]);

  return useInternalMutation<Hex, Error, Hex>({
    onSuccess,
    onError,
    mutationFn: async (shareId) => {
      const write = await cofheClient.acp.prepareRemoveShare(shareId);
      registry.current = write.address;
      return send(write, { description: `Share ${shareId}`, payload: { shareId } });
    },
  });
};

/**
 * Issuer side: revoke an ACP through its revoker contract. Simulated first, recorded in the
 * transaction store, resolves once mined; the ACP on-chain status (`useCofheACPStatus`,
 * `<CofheACPScope>`) and the revoker read refetch then.
 */
export const useCofheRevokeACP = ({ onSuccess, onError }: MutationCallbacks = {}) => {
  const cofheClient = useCofheClient();
  const revoking = useRef<ACP | undefined>(undefined);
  const send = useSharingWrite(TransactionActionType.RevokeACP, () => {
    const acp = revoking.current;
    if (!acp) return [];
    return [{ address: acp.revokerContract, functionName: 'disabled' }, [ACP_STATUS_QUERY_KEY, acp.hash]];
  });

  return useInternalMutation<Hex, Error, ACP>({
    onSuccess,
    onError,
    mutationFn: async (acp) => {
      const write = cofheClient.acp.prepareRevokeACP(acp);
      revoking.current = acp;
      return send(write, { description: acp.name, payload: { acpHash: acp.hash } });
    },
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
