import {
  type UseMutationOptions,
  type UseMutationResult,
  type UseQueryOptions,
  type UseQueryResult,
} from '@tanstack/react-query';
import { type Address } from 'viem';
import { useCofheWalletClient, useCofheChainId, useCofheAccount, useCofhePublicClient } from './useCofheConnection.js';
import { type Token, ETH_ADDRESS_LOWERCASE } from './useCofheTokenLists.js';
import {
  SHIELD_ABIS,
  UNSHIELD_ABIS,
  CLAIM_ABIS,
  DUAL_GET_UNSHIELD_CLAIM_ABI,
  WRAPPED_ETH_ENCRYPT_ETH_ABI,
  WRAPPED_ENCRYPT_ABI,
  WRAPPED_GET_USER_CLAIMS_ABI,
  ERC20_APPROVE_ABI,
} from '../constants/confidentialTokenABIs.js';
import { TransactionActionType, useTransactionStore } from '../stores/transactionStore.js';
import { useInternalMutation, useInternalQuery } from '../providers/index.js';
import { assert } from 'ts-essentials';
import { useTransactionGlobalLifecycle } from './useTransactionGlobalLifecycle.js';
import type { CofheSimulateWriteContractCallArgs } from './useCofheSimulateWriteContract.js';

export function getCofheTokenShieldCallArgs(params: { token: Token; amount: bigint; account: Address }): {
  main: CofheSimulateWriteContractCallArgs;
  approval?: CofheSimulateWriteContractCallArgs;
} {
  const { token, amount, account } = params;
  const tokenAddress: Address = token.address;
  const confidentialityType = token.extensions.fhenix.confidentialityType;

  if (!confidentialityType) {
    throw new Error('confidentialityType is required in token extensions');
  }

  if (confidentialityType !== 'dual' && confidentialityType !== 'wrapped') {
    throw new Error(`Shield not supported for confidentialityType: ${confidentialityType}`);
  }

  if (confidentialityType === 'dual') {
    const contractConfig = SHIELD_ABIS.dual;
    return {
      main: {
        address: tokenAddress,
        abi: contractConfig.abi,
        functionName: contractConfig.functionName,
        args: [amount],
        account,
        chain: undefined,
      },
    };
  }

  // wrapped
  const erc20PairAddress = token.extensions.fhenix.erc20Pair?.address;
  const isEth = erc20PairAddress?.toLowerCase() === ETH_ADDRESS_LOWERCASE;

  if (isEth) {
    return {
      main: {
        address: tokenAddress,
        abi: WRAPPED_ETH_ENCRYPT_ETH_ABI,
        functionName: 'encryptETH',
        args: [account],
        value: amount,
        account,
        chain: undefined,
      },
    };
  }

  if (!erc20PairAddress) {
    throw new Error('erc20Pair address is required for wrapped ERC20 tokens');
  }

  return {
    approval: {
      address: erc20PairAddress,
      abi: ERC20_APPROVE_ABI,
      functionName: 'approve',
      args: [tokenAddress, amount],
      account,
      chain: undefined,
    },
    main: {
      address: tokenAddress,
      abi: WRAPPED_ENCRYPT_ABI,
      functionName: 'encrypt',
      args: [account, amount],
      account,
      chain: undefined,
    },
  };
}

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
  const { onSuccess, onError, ...restOfOptions } = options || {};
  const { onTransactionSubmitError } = useTransactionGlobalLifecycle();
  return useInternalMutation({
    mutationFn: async (input: UseTokenShieldInput) => {
      if (!walletClient) {
        throw new Error('WalletClient is required for token shield');
      }

      if (!publicClient) {
        throw new Error('PublicClient is required to simulate shield before writing');
      }

      const tokenAddress: Address = input.token.address;
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
        const erc20PairAddress = input.token.extensions.fhenix.erc20Pair?.address;
        const isEth = erc20PairAddress?.toLowerCase() === ETH_ADDRESS_LOWERCASE;

        if (isEth) {
          // For ETH: use encryptETH(address to) with value
          const { request } = await publicClient.simulateContract({
            address: tokenAddress,
            abi: WRAPPED_ETH_ENCRYPT_ETH_ABI,
            functionName: 'encryptETH',
            args: [walletClient.account.address],
            value: input.amount,
            account: walletClient.account,
          });
          hash = await walletClient.writeContract({ ...request, chain: undefined });
        } else {
          // For ERC20 wrapped tokens: caller is expected to handle approval.
          if (!erc20PairAddress) {
            throw new Error('erc20Pair address is required for wrapped ERC20 tokens');
          }

          // Now call encrypt
          input.onStatusChange?.('Please confirm shield in wallet...');
          const { request: encryptRequest } = await publicClient.simulateContract({
            address: tokenAddress,
            abi: WRAPPED_ENCRYPT_ABI,
            functionName: 'encrypt',
            args: [walletClient.account.address, input.amount],
            account: walletClient.account,
          });
          hash = await walletClient.writeContract({ ...encryptRequest, chain: undefined });
        }
      } else {
        // Dual tokens: use shield(uint256 amount)
        const contractConfig = SHIELD_ABIS.dual;

        const { request } = await publicClient.simulateContract({
          address: tokenAddress,
          abi: contractConfig.abi,
          functionName: contractConfig.functionName,
          args: [input.amount],
          account: walletClient.account,
        });
        hash = await walletClient.writeContract({ ...request, chain: undefined });
      }

      return hash;
    },
    onError: (error, variables, onMutateResult, context) => {
      if (onError) onError(error, variables, onMutateResult, context);
      onTransactionSubmitError(error, TransactionActionType.Shield);
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
