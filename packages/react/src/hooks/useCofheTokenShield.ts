import {
  type UseMutationOptions,
  type UseMutationResult,
  type UseQueryOptions,
  type UseQueryResult,
} from '@tanstack/react-query';
import { type Address } from 'viem';
import { useCofheWalletClient, useCofheChainId, useCofheAccount, useCofhePublicClient } from './useCofheConnection.js';
import { type Token, ETH_ADDRESS } from './useCofheTokenLists.js';
import {
  SHIELD_ABIS,
  UNSHIELD_ABIS,
  CLAIM_ABIS,
  DUAL_GET_UNSHIELD_CLAIM_ABI,
  WRAPPED_ETH_ENCRYPT_ETH_ABI,
  WRAPPED_ENCRYPT_ABI,
  WRAPPED_GET_USER_CLAIMS_ABI,
  ERC20_ALLOWANCE_ABI,
  ERC20_APPROVE_ABI,
} from '../constants/confidentialTokenABIs.js';
import { TransactionActionType, useTransactionStore } from '../stores/transactionStore.js';
import { useInternalMutation, useInternalQuery } from '../providers/index.js';
import { assert } from 'ts-essentials';

// ============================================================================
// Types
// ============================================================================

export type UnshieldClaim = {
  ctHash: bigint;
  requestedAmount: bigint;
  decryptedAmount: bigint;
  decrypted: boolean;
  claimed: boolean;
};

type UseTokenShieldInput = {
  /** Token object with confidentialityType */
  token: Token;
  /** Amount to shield (in token's smallest unit) */
  amount: bigint;
  /** Optional callback for status updates during the operation */
  onStatusChange?: (message: string) => void;
};

type UseTokenShieldOptions = Omit<UseMutationOptions<`0x${string}`, Error, UseTokenShieldInput>, 'mutationFn'>;

// ============================================================================
// Shield Hook
// ============================================================================

/**
 * Hook to shield tokens (convert regular balance to confidential)
 * - Dual tokens: calls `shield(uint256 amount)`
 * - Wrapped tokens: TBD (needs approval flow)
 * @param options - Optional React Query mutation options
 * @returns Mutation result with transaction hash
 */
export function useCofheTokenShield(
  options?: UseTokenShieldOptions
): UseMutationResult<`0x${string}`, Error, UseTokenShieldInput> {
  const walletClient = useCofheWalletClient();
  const publicClient = useCofhePublicClient();
  const chainId = useCofheChainId();
  const account = useCofheAccount();
  const { onSuccess, ...restOfOptions } = options || {};

  return useInternalMutation({
    mutationFn: async (input: UseTokenShieldInput) => {
      if (!walletClient) {
        throw new Error('WalletClient is required for token shield');
      }

      const tokenAddress = input.token.address as Address;
      const confidentialityType = input.token.extensions.fhenix.confidentialityType;

      if (!confidentialityType) {
        throw new Error('confidentialityType is required in token extensions');
      }

      if (!walletClient.account) {
        throw new Error('Wallet account is required for token shield');
      }

      // Only dual and wrapped support shielding
      if (confidentialityType !== 'dual' && confidentialityType !== 'wrapped') {
        throw new Error(`Shield not supported for confidentialityType: ${confidentialityType}`);
      }

      let hash: `0x${string}`;

      if (confidentialityType === 'wrapped') {
        // Check if this is a wrapped ETH token (erc20Pair is ETH_ADDRESS)
        const erc20PairAddress = input.token.extensions.fhenix.erc20Pair?.address as Address | undefined;
        const isEth = erc20PairAddress?.toLowerCase() === ETH_ADDRESS.toLowerCase();

        if (isEth) {
          // For ETH: use encryptETH(address to) with value
          hash = await walletClient.writeContract({
            address: tokenAddress,
            abi: WRAPPED_ETH_ENCRYPT_ETH_ABI,
            functionName: 'encryptETH',
            args: [walletClient.account.address],
            value: input.amount,
            account: walletClient.account,
            chain: undefined,
          });
        } else {
          // For ERC20 wrapped tokens: need to check allowance and approve if needed
          if (!erc20PairAddress) {
            throw new Error('erc20Pair address is required for wrapped ERC20 tokens');
          }

          if (!publicClient) {
            throw new Error('PublicClient is required for allowance check');
          }

          // Check current allowance
          input.onStatusChange?.('Checking allowance...');
          const currentAllowance = await publicClient.readContract({
            address: erc20PairAddress,
            abi: ERC20_ALLOWANCE_ABI,
            functionName: 'allowance',
            args: [walletClient.account.address, tokenAddress],
          });

          // If allowance is insufficient, request approval
          if (currentAllowance < input.amount) {
            input.onStatusChange?.('Approval required - please confirm in wallet...');
            // Request approval for the exact amount (or max uint256 for unlimited)
            const approvalHash = await walletClient.writeContract({
              address: erc20PairAddress,
              abi: ERC20_APPROVE_ABI,
              functionName: 'approve',
              args: [tokenAddress, input.amount],
              account: walletClient.account,
              chain: undefined,
            });

            // Wait for approval transaction to be confirmed
            input.onStatusChange?.('Waiting for approval confirmation...');
            await publicClient.waitForTransactionReceipt({ hash: approvalHash });
            input.onStatusChange?.('Approved! Now shielding...');
          }

          // Now call encrypt
          input.onStatusChange?.('Please confirm shield in wallet...');
          hash = await walletClient.writeContract({
            address: tokenAddress,
            abi: WRAPPED_ENCRYPT_ABI,
            functionName: 'encrypt',
            args: [walletClient.account.address, input.amount],
            account: walletClient.account,
            chain: undefined,
          });
        }
      } else {
        // Dual tokens: use shield(uint256 amount)
        const contractConfig = SHIELD_ABIS[confidentialityType];
        if (!contractConfig) {
          throw new Error(`Unsupported confidentialityType for shield: ${confidentialityType}`);
        }

        hash = await walletClient.writeContract({
          address: tokenAddress,
          abi: contractConfig.abi,
          functionName: contractConfig.functionName,
          args: [input.amount],
          account: walletClient.account,
          chain: undefined,
        });
      }

      return hash;
    },
    onSuccess: async (hash, input, onMutateResult, context) => {
      assert(chainId, 'Chain ID is required for token shield');
      assert(account, 'Wallet account is required for token shield');
      if (onSuccess) await onSuccess(hash, input, onMutateResult, context);

      // Record transaction and watch for confirmation
      useTransactionStore.getState().addTransaction({
        hash,
        token: input.token,
        tokenAmount: input.amount,
        chainId,
        actionType: TransactionActionType.Shield,
        isPendingDecryption: false, // doesn't need decryption afterwards
        account,
      });
    },
    ...restOfOptions,
  });
}
