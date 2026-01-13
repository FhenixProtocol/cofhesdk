import { type UseMutationOptions, type UseMutationResult } from '@tanstack/react-query';
import { type Address } from 'viem';
import { useCofheWalletClient, useCofheChainId, useCofheAccount } from './useCofheConnection.js';
import type { Token } from './useCofheTokenLists.js';
import { TRANSFER_ABIS } from '../constants/confidentialTokenABIs.js';
import { TransactionActionType, useTransactionStore } from '../stores/transactionStore.js';
import { useInternalMutation } from '../providers/index.js';
import { assert } from 'ts-essentials';
import { assertCorrectEncryptedItemInput, type EncryptedItemInput } from '@cofhe/sdk';

type UseTokenTransferInput = {
  /** Token object with confidentialityType */
  token: Token;
  /** Recipient address */
  to: Address;
  /** Encrypted value struct (ctHash, securityZone, utype, signature) */
  encryptedValue: EncryptedItemInput;
  /** Amount being transferred (for transaction history) */
  amount: bigint;
};

type UseTokenTransferOptions = Omit<UseMutationOptions<`0x${string}`, Error, UseTokenTransferInput>, 'mutationFn'>;

/**
 * Hook to transfer encrypted tokens based on token confidentialityType
 * Uses token.extensions.fhenix.confidentialityType to determine the correct ABI and function
 * @param options - Optional React Query mutation options
 * @returns Mutation result with transaction hash
 */
export function useCofheTokenTransfer(
  options?: UseTokenTransferOptions
): UseMutationResult<`0x${string}`, Error, UseTokenTransferInput> {
  const walletClient = useCofheWalletClient();
  const chainId = useCofheChainId();
  const account = useCofheAccount();
  const { onSuccess, ...restOfOptions } = options || {};

  return useInternalMutation({
    mutationFn: async ({ token, to: contractAddress, encryptedValue: inputEncryptedValue }: UseTokenTransferInput) => {
      assertCorrectEncryptedItemInput(inputEncryptedValue);

      if (!walletClient) {
        throw new Error('WalletClient is required for token transfer');
      }
      const tokenAddress = token.address;
      const confidentialityType = token.extensions.fhenix.confidentialityType;

      if (!confidentialityType) {
        throw new Error('confidentialityType is required in token extensions');
      }

      if (!walletClient.account) {
        throw new Error('Wallet account is required for token transfer');
      }

      const contractConfig = TRANSFER_ABIS[confidentialityType];
      if (!contractConfig) {
        throw new Error(`Unsupported confidentialityType: ${confidentialityType}`);
      }

      // Throw error if dual type is used (not yet implemented)
      if (confidentialityType === 'dual') {
        throw new Error('Dual confidentiality type is not yet implemented');
      }

      const hash = await walletClient.writeContract({
        address: tokenAddress,
        abi: contractConfig.abi,
        functionName: contractConfig.functionName,
        args: [contractAddress, inputEncryptedValue],
        account: walletClient.account,
        chain: undefined,
      });

      return hash;
    },
    onSuccess: async (hash, input, onMutateResult, context) => {
      assert(account, 'Wallet account is required for token transfer');
      assert(chainId, 'Chain ID is required for token transfer');
      if (onSuccess) await onSuccess(hash, input, onMutateResult, context);

      // Record transaction and watch for confirmation
      useTransactionStore.getState().addTransaction({
        hash,
        token: input.token,
        tokenAmount: input.amount,
        chainId,
        actionType: TransactionActionType.ShieldSend,
        account,
      });
    },
    ...restOfOptions,
  });
}
