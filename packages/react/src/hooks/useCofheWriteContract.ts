import type { QueryClient, QueryKey, UseMutationOptions, UseMutationResult } from '@tanstack/react-query';
import type {
  Abi,
  Account,
  Address,
  Chain,
  ContractFunctionArgs,
  ContractFunctionName,
  Hash,
  PublicClient,
  WalletClient,
  WriteContractParameters,
} from 'viem';
import { assert } from 'ts-essentials';
import { useInternalMutation, useInternalQueryClient } from '../providers/index.js';
import { useCofheChainId, useCofhePublicClient, useCofheWalletClient } from './useCofheConnection.js';
import { constructCofheReadContractQueryForInvalidation } from './useCofheReadContract';
import { invalidateQueriesWithContext, type InvalidationContextQueryFilters } from '../utils/invalidationContext';
import { resolveReceiptBlockHash } from '../utils/resolveReceiptBlockHash';
import { cofheLogger } from '../utils/debug';

type WalletWriteContractParamsAny = Parameters<WalletClient['writeContract']>[0];

export type WalletWriteContractInputWithExtras<TExtras> = {
  writeContractInput: WalletWriteContractParamsAny;
  extras: TExtras;
};

type WalletWriteContractMutationVariables<TExtras> =
  | WalletWriteContractParamsAny
  | WalletWriteContractInputWithExtras<TExtras>;

export function hasExtras<TExtras>(
  variables: WalletWriteContractMutationVariables<TExtras>
): variables is WalletWriteContractInputWithExtras<TExtras> {
  return (
    typeof variables === 'object' && variables !== null && 'writeContractInput' in variables && 'extras' in variables
  );
}

export type WalletWriteContractParams<
  TAbi extends Abi | readonly unknown[],
  TFunctionName extends ContractFunctionName<TAbi, 'payable' | 'nonpayable'>,
  TArgs extends ContractFunctionArgs<TAbi, 'payable' | 'nonpayable', TFunctionName>,
  TChainOverride extends Chain | undefined = undefined,
> = WriteContractParameters<TAbi, TFunctionName, TArgs, Chain | undefined, Account | undefined, TChainOverride>;

/**
 * Declarative invalidation target: the cofhe reads of one contract. `functionName` narrows it to
 * the `useCofheReadContract` queries for that view function (any args); omit it to refresh every
 * read of the contract. `chainId` defaults to the connected chain.
 */
export type CofheReadInvalidationDescriptor = {
  address: Address;
  functionName?: string;
  chainId?: number;
};

/**
 * A read-query target to refresh after a successful write: an `{ address, functionName }`
 * descriptor for cofhe contract reads, a raw query key (matched as a prefix, e.g. built with
 * `constructCofheReadContractQueryForInvalidation`), or full `InvalidateQueries` filters with a
 * required `queryKey`.
 */
export type CofheWriteInvalidationTarget = CofheReadInvalidationDescriptor | QueryKey | InvalidationContextQueryFilters;

export type useCofheWriteContractOptions<TExtras = unknown> = Omit<
  UseMutationOptions<Hash, Error, WalletWriteContractMutationVariables<TExtras>, unknown>,
  'mutationFn'
> & {
  /**
   * Read queries to invalidate after the write is mined, e.g.
   * `invalidates: [{ address: token, functionName: 'balanceOf' }]`. Invalidation fires once the
   * transaction is MINED (not when the hash is returned) and carries the mined block's hash as
   * invalidation context, so the triggered refetches wait until the serving RPC node knows that
   * block before trusting its state (see `invalidateQueriesWithContext`). Mined means mined:
   * a REVERTED transaction invalidates too — it still sits in a real block, burned gas and
   * advanced the nonce, so reads like an ETH balance are stale either way; refetches of state
   * the revert did not touch are cheap same-value no-ops. The wait runs in the background — the
   * mutation still resolves with the tx hash as soon as the transaction is sent.
   */
  invalidates?: readonly CofheWriteInvalidationTarget[];
};

function isQueryKeyTarget(target: CofheWriteInvalidationTarget): target is QueryKey {
  return Array.isArray(target);
}

function trimTrailingUndefined(queryKey: readonly unknown[]): readonly unknown[] {
  let end = queryKey.length;
  while (end > 0 && queryKey[end - 1] === undefined) end -= 1;
  return queryKey.slice(0, end);
}

function normalizeInvalidationTarget(
  target: CofheWriteInvalidationTarget,
  connectedChainId: number | undefined
): InvalidationContextQueryFilters {
  if (isQueryKeyTarget(target)) return { queryKey: target, exact: false };
  if ('queryKey' in target) return target;

  return {
    // Trailing undefined segments (an omitted functionName) would only match queries carrying
    // that exact undefined segment; trimmed, the prefix matches every read of the contract.
    queryKey: trimTrailingUndefined(
      constructCofheReadContractQueryForInvalidation({
        cofheChainId: target.chainId ?? connectedChainId,
        address: target.address,
        functionName: target.functionName,
      })
    ),
    exact: false,
  };
}

async function invalidateOnceMined(params: {
  publicClient: PublicClient;
  queryClient: QueryClient;
  txHash: Hash;
  targets: readonly CofheWriteInvalidationTarget[];
  connectedChainId: number | undefined;
}): Promise<void> {
  const { publicClient, queryClient, txHash, targets, connectedChainId } = params;

  try {
    const receipt = await publicClient.waitForTransactionReceipt({ hash: txHash });
    // Deliberately NO status check: a reverted tx is still mined — it burned gas and advanced
    // the nonce in a real block, so declared reads (an ETH balance, a nonce-dependent view) are
    // stale regardless of outcome. Targets the revert did not touch refetch to the same value.
    const { blockHash } = await resolveReceiptBlockHash(receipt, publicClient);

    await Promise.all(
      targets.map((target) =>
        invalidateQueriesWithContext(queryClient, normalizeInvalidationTarget(target, connectedChainId), {
          blockHashToBeAwareOf: blockHash,
        })
      )
    );
  } catch (error) {
    cofheLogger.warn('Failed to invalidate read queries after write transaction', { txHash, error });
  }
}

/**
 * Low-level mutation hook: call `walletClient.writeContract`.
 *
 * Unlike `useCofheWriteContract`, this accepts viem's full `writeContract` parameter type.
 */
export function useCofheWriteContract<TExtras = unknown>(
  options?: useCofheWriteContractOptions<TExtras>
): UseMutationResult<Hash, Error, WalletWriteContractMutationVariables<TExtras>, unknown> & {
  writeContractAsync: <
    TAbi extends Abi | readonly unknown[],
    TFunctionName extends ContractFunctionName<TAbi, 'payable' | 'nonpayable'>,
    TArgs extends ContractFunctionArgs<TAbi, 'payable' | 'nonpayable', TFunctionName>,
    TChainOverride extends Chain | undefined = undefined,
  >(
    params:
      | WalletWriteContractParams<TAbi, TFunctionName, TArgs, TChainOverride>
      | {
          writeContractInput: WalletWriteContractParams<TAbi, TFunctionName, TArgs, TChainOverride>;
          extras: TExtras;
        }
  ) => Promise<Hash>;
  writeContract: <
    TAbi extends Abi | readonly unknown[],
    TFunctionName extends ContractFunctionName<TAbi, 'payable' | 'nonpayable'>,
    TArgs extends ContractFunctionArgs<TAbi, 'payable' | 'nonpayable', TFunctionName>,
    TChainOverride extends Chain | undefined = undefined,
  >(
    params:
      | WalletWriteContractParams<TAbi, TFunctionName, TArgs, TChainOverride>
      | {
          writeContractInput: WalletWriteContractParams<TAbi, TFunctionName, TArgs, TChainOverride>;
          extras: TExtras;
        }
  ) => void;
} {
  const walletClient = useCofheWalletClient();
  const publicClient = useCofhePublicClient();
  const queryClient = useInternalQueryClient();
  const cofheChainId = useCofheChainId();

  const { invalidates, onSuccess, ...mutationOptions } = options ?? {};

  const mutation = useInternalMutation<Hash, Error, WalletWriteContractMutationVariables<TExtras>, unknown>({
    ...mutationOptions,
    mutationKey: mutationOptions.mutationKey ?? ['cofhe', 'walletWriteContract'],
    onSuccess: (hash, ...rest) => {
      if (invalidates?.length && publicClient) {
        // Background: invalidation waits for the tx to mine; the mutation result is the hash.
        void invalidateOnceMined({
          publicClient,
          queryClient,
          txHash: hash,
          targets: invalidates,
          connectedChainId: cofheChainId,
        });
      }
      return onSuccess?.(hash, ...rest);
    },
    mutationFn: async (variables) => {
      assert(walletClient, 'WalletClient is required to write to a contract');
      assert(publicClient, 'PublicClient is required to simulate contract before writing');

      const writeContractInput = hasExtras(variables) ? variables.writeContractInput : variables;

      const accountForSimulation = writeContractInput.account ?? walletClient.account;
      assert(accountForSimulation, 'Wallet account is required to simulate contract before writing');

      const { chain, ...rest } = writeContractInput;
      const { request } = await publicClient.simulateContract({
        ...(chain ? { ...rest, chain } : rest),
        account: accountForSimulation,
      });
      return walletClient.writeContract({ ...request, chain: undefined });
    },
  });

  const writeContractAsync = async <
    TAbi extends Abi | readonly unknown[],
    TFunctionName extends ContractFunctionName<TAbi, 'payable' | 'nonpayable'>,
    TArgs extends ContractFunctionArgs<TAbi, 'payable' | 'nonpayable', TFunctionName>,
    TChainOverride extends Chain | undefined = undefined,
  >(
    params:
      | WalletWriteContractParams<TAbi, TFunctionName, TArgs, TChainOverride>
      | {
          writeContractInput: WalletWriteContractParams<TAbi, TFunctionName, TArgs, TChainOverride>;
          extras: TExtras;
        }
  ) => mutation.mutateAsync(params as unknown as WalletWriteContractMutationVariables<TExtras>);

  const writeContract = <
    TAbi extends Abi | readonly unknown[],
    TFunctionName extends ContractFunctionName<TAbi, 'payable' | 'nonpayable'>,
    TArgs extends ContractFunctionArgs<TAbi, 'payable' | 'nonpayable', TFunctionName>,
    TChainOverride extends Chain | undefined = undefined,
  >(
    params:
      | WalletWriteContractParams<TAbi, TFunctionName, TArgs, TChainOverride>
      | {
          writeContractInput: WalletWriteContractParams<TAbi, TFunctionName, TArgs, TChainOverride>;
          extras: TExtras;
        }
  ) => mutation.mutate(params as unknown as WalletWriteContractMutationVariables<TExtras>);

  return {
    ...mutation,
    writeContractAsync,
    writeContract,
  };
}
