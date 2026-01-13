import { type UseMutationOptions, type UseMutationResult } from '@tanstack/react-query';
import { type Address } from 'viem';
import { useCofheWalletClient, useCofheChainId, useCofheAccount } from './useCofheConnection.js';
import { type Token } from './useCofheTokenLists.js';
import { CLAIM_ABIS } from '../constants/confidentialTokenABIs.js';
import { TransactionActionType, useTransactionStore } from '../stores/transactionStore.js';
import { useInternalMutation } from '../providers/index.js';
import { assert } from 'ts-essentials';

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
  const chainId = useCofheChainId();
  const account = useCofheAccount();
  const { onSuccess, ...restOfOptions } = options || {};

  return useInternalMutation({
    mutationFn: async (input: UseClaimUnshieldInput) => {
      if (!walletClient) {
        throw new Error('WalletClient is required for claim');
      }

      const tokenAddress = input.token.address as Address;
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

      const hash = await walletClient.writeContract({
        address: tokenAddress,
        abi: contractConfig.abi,
        functionName: contractConfig.functionName,
        args: [],
        account: walletClient.account,
        chain: undefined,
      });
      return hash;
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
        account,
      });
    },
    ...restOfOptions,
  });
}
