import { type MutationFunctionContext, type UseMutationOptions, type UseMutationResult } from '@tanstack/react-query';
import { type Address } from 'viem';
import { useCofheWalletClient, useCofheChainId, useCofheAccount, useCofhePublicClient } from './useCofheConnection.js';
import { type Token } from './useCofheTokenLists.js';
import { assertTokenOperationSupported } from '@/types/token';
import { getUnshieldContractConfig } from '../constants/confidentialTokenABIs.js';
import { TransactionActionType, TransactionStatus, useTransactionStore } from '../stores/transactionStore.js';
import { useInternalMutation } from '../providers/index.js';
import { assert } from 'ts-essentials';
import { useOnceTransactionMined } from './useOnceTransactionMined.js';
import { useOnceDecrypted } from './useOnceDecrypted.js';
import { useTransactionGlobalLifecycle } from './useTransactionGlobalLifecycle.js';
import type { CofheSimulateWriteContractCallArgs } from './useCofheSimulateWriteContract.js';

export function getCofheTokenUnshieldCallArgs(params: {
  token: Token;
  amount: bigint;
  account: Address;
}): CofheSimulateWriteContractCallArgs {
  const { token, amount: rawAmount, account } = params;
  const tokenAddress: Address = token.address;
  const confidentialityType = token.extensions.fhenix.confidentialityType;

  if (!confidentialityType) {
    throw new Error('confidentialityType is required in token extensions');
  }

  assertTokenOperationSupported(confidentialityType, 'unshield');

  const contractConfig = getUnshieldContractConfig(confidentialityType);

  return {
    address: tokenAddress,
    abi: contractConfig.abi,
    functionName: contractConfig.functionName,
    args: [account, rawAmount],
    account,
    chain: undefined,
  };
}

// ============================================================================
// Unshield Hook
// ============================================================================
type UseTokenUnshieldMutationInput = {
  /** Token object with confidentialityType */
  token: Token;
  /** Amount to unshield (in token's smallest unit) */
  amount: bigint;
  /** Optional callback for status updates during the operation */
  onStatusChange?: (message: string) => void;
};

type UseTokenUnshieldMutationOptions = Omit<
  UseMutationOptions<`0x${string}`, Error, UseTokenUnshieldMutationInput>,
  'mutationFn'
>;
/**
 * Hook to unshield tokens (initiate conversion from confidential to regular)
 * Wrapped tokens call `decrypt(address to, uint128 value)` and then need to be claimed.
 * @param options - Optional React Query mutation options
 * @returns Mutation result with transaction hash
 */
function useCofheTokenUnshieldMutation(
  options?: UseTokenUnshieldMutationOptions
): UseMutationResult<`0x${string}`, Error, UseTokenUnshieldMutationInput> {
  const walletClient = useCofheWalletClient();
  const publicClient = useCofhePublicClient();
  const chainId = useCofheChainId();
  const account = useCofheAccount();
  const { onTransactionSubmitError } = useTransactionGlobalLifecycle();

  const { onSuccess, onError, ...restOfOptions } = options || {};

  return useInternalMutation({
    mutationFn: async (input: UseTokenUnshieldMutationInput) => {
      if (!walletClient) {
        throw new Error('WalletClient is required for token unshield');
      }

      if (!publicClient) {
        throw new Error('PublicClient is required to simulate unshield before writing');
      }

      const tokenAddress: Address = input.token.address;
      const confidentialityType = input.token.extensions.fhenix.confidentialityType;

      if (!confidentialityType) {
        throw new Error('confidentialityType is required in token extensions');
      }

      if (!walletClient.account) {
        throw new Error('Wallet account is required for token unshield');
      }

      assertTokenOperationSupported(confidentialityType, 'unshield');

      const contractConfig = getUnshieldContractConfig(confidentialityType);

      let hash: `0x${string}`;

      input.onStatusChange?.('Please confirm in wallet...');

      const { request } = await publicClient.simulateContract({
        address: tokenAddress,
        abi: contractConfig.abi,
        functionName: contractConfig.functionName,
        args: [walletClient.account.address, input.amount],
        account: walletClient.account,
      });
      hash = await walletClient.writeContract({ ...request, chain: undefined });

      return hash;
    },
    onError: (error, variables, onMutateResult, context) => {
      if (onError) onError(error, variables, onMutateResult, context);
      onTransactionSubmitError(error, TransactionActionType.Unshield);
    },
    onSuccess: async (hash, input, onMutateResult, context) => {
      assert(chainId, 'Chain ID is required for token unshield');
      assert(account, 'Wallet account is required for token unshield');
      if (onSuccess) await onSuccess(hash, input, onMutateResult, context);

      useTransactionStore.getState().addTransaction({
        hash,
        token: input.token,
        tokenAmount: input.amount,
        chainId,
        actionType: TransactionActionType.Unshield,
        isPendingDecryption: true, // is tx that requires decryption afterwards
        account,
      });
    },
    ...restOfOptions,
  });
}

type UseCofheTokenUnshieldInput = {
  onUserSignatureRequest?: (variables: UseTokenUnshieldMutationInput, context: MutationFunctionContext) => void;
  onTransactionSubmitSuccess?: (hash: `0x${string}`) => void;
  onTransactionSubmitError?: (error: Error) => void;
  onceMined?: (transaction: { hash: `0x${string}`; status: TransactionStatus }) => void;
  onceDecrypted?: () => void;
};
export function useCofheTokenUnshield(input: UseCofheTokenUnshieldInput) {
  const unshieldMutation = useCofheTokenUnshieldMutation({
    onMutate: input.onUserSignatureRequest,
    onSuccess: input.onTransactionSubmitSuccess,
    onError: input.onTransactionSubmitError,
  });

  const { isMining: isTokenUnshieldMining } = useOnceTransactionMined({
    txHash: unshieldMutation.data,
    onceMined: input.onceMined,
  });

  const { isPendingDecryption } = useOnceDecrypted({
    txHash: unshieldMutation.data,
    onceDecrypted: input.onceDecrypted,
  });

  return {
    ...unshieldMutation,
    isTokenUnshieldMining,
    isPendingDecryption,
  };
}
