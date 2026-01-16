import { type UseMutationOptions, type UseMutationResult } from '@tanstack/react-query';
import { type Address } from 'viem';
import { useCofheWalletClient, useCofheChainId, useCofheAccount, useCofhePublicClient } from './useCofheConnection.js';
import { type Token } from './useCofheTokenLists.js';
import { UNSHIELD_ABIS } from '../constants/confidentialTokenABIs.js';
import { TransactionActionType, useTransactionStore } from '../stores/transactionStore.js';
import { useInternalMutation } from '../providers/index.js';
import { assert } from 'ts-essentials';

// ============================================================================
// Unshield Hook
// ============================================================================
type UseTokenUnshieldInput = {
  /** Token object with confidentialityType */
  token: Token;
  /** Amount to unshield (in token's smallest unit, uint64 max for dual) */
  amount: bigint;
  /** Optional callback for status updates during the operation */
  onStatusChange?: (message: string) => void;
};

type UseTokenUnshieldOptions = Omit<UseMutationOptions<`0x${string}`, Error, UseTokenUnshieldInput>, 'mutationFn'>;
/**
 * Hook to unshield tokens (initiate conversion from confidential to regular)
 * - Dual tokens: calls `unshield(uint64 amount)`, then need to claim
 * - Wrapped tokens: TBD
 * @param options - Optional React Query mutation options
 * @returns Mutation result with transaction hash
 */
export function useCofheTokenUnshield(
  options?: UseTokenUnshieldOptions
): UseMutationResult<`0x${string}`, Error, UseTokenUnshieldInput> {
  const walletClient = useCofheWalletClient();
  const chainId = useCofheChainId();
  const account = useCofheAccount();

  const { onSuccess, ...restOfOptions } = options || {};

  return useInternalMutation({
    mutationFn: async (input: UseTokenUnshieldInput) => {
      if (!walletClient) {
        throw new Error('WalletClient is required for token unshield');
      }

      const tokenAddress = input.token.address as Address;
      const confidentialityType = input.token.extensions.fhenix.confidentialityType;

      if (!confidentialityType) {
        throw new Error('confidentialityType is required in token extensions');
      }

      if (!walletClient.account) {
        throw new Error('Wallet account is required for token unshield');
      }

      // Only dual and wrapped support unshielding
      if (confidentialityType !== 'dual' && confidentialityType !== 'wrapped') {
        throw new Error(`Unshield not supported for confidentialityType: ${confidentialityType}`);
      }

      const contractConfig = UNSHIELD_ABIS[confidentialityType];
      if (!contractConfig) {
        throw new Error(`Unsupported confidentialityType for unshield: ${confidentialityType}`);
      }

      let hash: `0x${string}`;

      input.onStatusChange?.('Please confirm in wallet...');

      if (confidentialityType === 'wrapped') {
        // Wrapped tokens: decrypt(address to, uint128 value)
        hash = await walletClient.writeContract({
          address: tokenAddress,
          abi: contractConfig.abi,
          functionName: contractConfig.functionName,
          args: [walletClient.account.address, input.amount],
          account: walletClient.account,
          chain: undefined,
        });
      } else {
        // For dual tokens, unshield takes uint64
        const amount = BigInt.asUintN(64, input.amount);

        hash = await walletClient.writeContract({
          address: tokenAddress,
          abi: contractConfig.abi,
          functionName: contractConfig.functionName,
          args: [amount],
          account: walletClient.account,
          chain: undefined,
        });
      }

      return hash;
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
