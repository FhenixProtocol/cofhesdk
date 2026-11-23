import type { Address } from 'viem';
import type { ConfidentialToken } from './useCofheTokenLists.js';
import { TransactionActionType, TransactionStatus, useTransactionStore } from '../stores/transactionStore.js';
import { getPublicDecimals } from '@/types/token';
import { useOnceTransactionMined } from './useOnceTransactionMined.js';
import { useTransactionGlobalLifecycle } from './useTransactionGlobalLifecycle.js';
import { hasExtras, useCofheWriteContract, type useCofheWriteContractOptions } from './useCofheWriteContract.js';

export type TokenApproveExtras = {
  token: ConfidentialToken;
  tokenAmount: bigint;
  account: Address;
};

export type UseCofheTokenApproveOptions = Pick<
  useCofheWriteContractOptions<TokenApproveExtras>,
  'onSuccess' | 'onError' | 'onMutate'
> & {
  /**
   * Fires once, when the approval mines, with its final status (confirmed or failed).
   * Only an approval sent with `extras` is recorded in the transaction store, so only such an
   * approval reaches this callback or reports `isMining`.
   */
  onceMined?: (transaction: { hash: `0x${string}`; status: TransactionStatus }) => void;
};

/**
 * Low-level approval writer.
 *
 * Wraps `useCofheWriteContract` with:
 * - Global tx submit error reporting
 * - Persisting approval txs in the transaction store (when `extras` are provided)
 * - `isMining` (true from the hash until the receipt lands) and `onceMined`, read from the store
 */
export function useCofheTokenApprove(writeMutationOptions?: UseCofheTokenApproveOptions) {
  const {
    onSuccess: passedOnSuccess,
    onError: passedOnError,
    onceMined,
    ...restOfOptions
  } = writeMutationOptions || {};
  const { onTransactionSubmitError } = useTransactionGlobalLifecycle();

  const write = useCofheWriteContract<TokenApproveExtras>({
    ...restOfOptions,
    onError: (error, variables, onMutateResult, context) => {
      if (passedOnError) passedOnError(error, variables, onMutateResult, context);
      onTransactionSubmitError(error, TransactionActionType.Approve);
    },
    onSuccess: (hash, variables, onMutateResult, context) => {
      if (passedOnSuccess) passedOnSuccess(hash, variables, onMutateResult, context);

      if (!hasExtras(variables)) return;
      const { token, tokenAmount, account } = variables.extras;

      useTransactionStore.getState().addTransaction({
        hash,
        token,
        tokenAmount,
        tokenAmountDecimals: getPublicDecimals(token),
        chainId: token.chainId,
        actionType: TransactionActionType.Approve,
        account,
      });
    },
  });

  const { isMining } = useOnceTransactionMined({ txHash: write.data, onceMined });

  return { ...write, isMining };
}
