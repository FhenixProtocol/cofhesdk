import type { Address } from 'viem';
import type { Token } from './useCofheTokenLists.js';
import { TransactionActionType, useTransactionStore } from '../stores/transactionStore.js';
import { useTransactionGlobalLifecycle } from './useTransactionGlobalLifecycle.js';
import { hasExtras, useCofheWriteContract, type useCofheWriteContractOptions } from './useCofheWriteContract.js';

export type TokenApproveExtras = {
  token: Token;
  tokenAmount: bigint;
  account: Address;
};

export type UseCofheTokenApproveOptions = Pick<
  useCofheWriteContractOptions<TokenApproveExtras>,
  'onSuccess' | 'onError' | 'onMutate'
>;

/**
 * Low-level approval writer.
 *
 * Wraps `useCofheWriteContract` with:
 * - Global tx submit error reporting
 * - Persisting approval txs in the transaction store (when `extras` are provided)
 */
export function useCofheTokenApprove(writeMutationOptions?: UseCofheTokenApproveOptions) {
  const { onSuccess: passedOnSuccess, onError: passedOnError, ...restOfOptions } = writeMutationOptions || {};
  const { onTransactionSubmitError } = useTransactionGlobalLifecycle();

  return useCofheWriteContract<TokenApproveExtras>({
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
        chainId: token.chainId,
        actionType: TransactionActionType.Approve,
        isPendingDecryption: false,
        account,
      });
    },
  });
}
