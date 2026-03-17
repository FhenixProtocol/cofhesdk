import { type UseMutationOptions, type UseMutationResult } from '@tanstack/react-query';
import { type Address } from 'viem';
import { useCofheWalletClient, useCofheChainId, useCofheAccount, useCofhePublicClient } from './useCofheConnection.js';
import { type Token } from './useCofheTokenLists.js';
import { CLAIM_ABIS } from '../constants/confidentialTokenABIs.js';
import { TransactionActionType, useTransactionStore } from '../stores/transactionStore.js';
import { useInternalMutation } from '../providers/index.js';
import { assert } from 'ts-essentials';
import { useTransactionGlobalLifecycle } from './useTransactionGlobalLifecycle.js';
import type { CofheSimulateWriteContractCallArgs } from './useCofheSimulateWriteContract.js';

export function getCofheTokenClaimUnshieldedCallArgs(params: {
  token: Token;
  account: Address;
}): CofheSimulateWriteContractCallArgs {
  const { token, account } = params;

  const tokenAddress: Address = token.address;
  const confidentialityType = token.extensions.fhenix.confidentialityType;

  if (!confidentialityType) {
    throw new Error('confidentialityType is required in token extensions');
  }

  if (confidentialityType !== 'dual' && confidentialityType !== 'wrapped') {
    throw new Error(`Claim not supported for confidentialityType: ${confidentialityType}`);
  }

  const contractConfig = CLAIM_ABIS[confidentialityType];
  if (!contractConfig) {
    throw new Error(`Unsupported confidentialityType for claim: ${confidentialityType}`);
  }

  return {
    address: tokenAddress,
    abi: contractConfig.abi,
    functionName: contractConfig.functionName,
    args: [],
    account,
    chain: undefined,
  };
}

// ============================================================================
// Claim Unshield Hook
// ============================================================================
type UseClaimUnshieldInput = {
  /** Token object with confidentialityType */
  token: Token;
  /** Amount being claimed (for activity logging) */
  amount: bigint;
};
type UseClaimUnshieldOptions = Omit<UseMutationOptions<`0x${string}`, Error, UseClaimUnshieldInput>, 'mutationFn'>;
/**
 * Hook to claim unshielded tokens after decryption completes
 * - Dual tokens: calls `claimUnshielded()`
 * - Wrapped tokens: calls `claimAllDecrypted()`
 * @param options - Optional React Query mutation options
 * @returns Mutation result with transaction hash
 */
export function useCofheTokenClaimUnshielded(
  options?: UseClaimUnshieldOptions
): UseMutationResult<`0x${string}`, Error, UseClaimUnshieldInput> {
  const walletClient = useCofheWalletClient();
  const publicClient = useCofhePublicClient();
  const chainId = useCofheChainId();
  const account = useCofheAccount();
  const { onSuccess, onError, ...restOfOptions } = options || {};
  const { onTransactionSubmitError } = useTransactionGlobalLifecycle();
  return useInternalMutation({
    mutationFn: async (input: UseClaimUnshieldInput) => {
      if (!walletClient) {
        throw new Error('WalletClient is required for claim');
      }

      if (!publicClient) {
        throw new Error('PublicClient is required to simulate claim before writing');
      }

      const tokenAddress: Address = input.token.address;
      const confidentialityType = input.token.extensions.fhenix.confidentialityType;

      if (!confidentialityType) {
        throw new Error('confidentialityType is required in token extensions');
      }

      if (!walletClient.account) {
        throw new Error('Wallet account is required for claim');
      }

      // Only dual and wrapped support claiming
      if (confidentialityType !== 'dual' && confidentialityType !== 'wrapped') {
        throw new Error(`Claim not supported for confidentialityType: ${confidentialityType}`);
      }

      const contractConfig = CLAIM_ABIS[confidentialityType];
      if (!contractConfig) {
        throw new Error(`Unsupported confidentialityType for claim: ${confidentialityType}`);
      }

      const { request } = await publicClient.simulateContract({
        address: tokenAddress,
        abi: contractConfig.abi,
        functionName: contractConfig.functionName,
        args: [],
        account: walletClient.account,
      });
      return await walletClient.writeContract({ ...request, chain: undefined });
    },
    onError: (error, variables, onMutateResult, context) => {
      if (onError) onError(error, variables, onMutateResult, context);
      onTransactionSubmitError(error, TransactionActionType.Claim);
    },
    onSuccess: async (hash, input, onMutateResult, context) => {
      assert(chainId, 'Chain ID is required for claim');
      assert(account, 'Wallet account is required for claim');
      if (onSuccess) await onSuccess(hash, input, onMutateResult, context);

      useTransactionStore.getState().addTransaction({
        hash,

        token: input.token,
        tokenAmount: input.amount,

        chainId,
        actionType: TransactionActionType.Claim,
        isPendingDecryption: false, // doesn't need decryption afterwards
        account,
      });
    },
    ...restOfOptions,
  });
}
