import { useMutation, type UseMutationOptions, type UseMutationResult } from '@tanstack/react-query';
import { type Address } from 'viem';
import { useCofheWalletClient, useCofheChainId, useCofheAccount, useCofhePublicClient } from './useCofheConnection.js';
import type { Token } from './useTokenLists.js';
import { TRANSFER_ABIS } from '../constants/confidentialTokenABIs.js';
import { useTransactionStore, TransactionActionType, TransactionStatus } from '../stores/transactionStore.js';


// Encrypted value struct type
export type EncryptedValue = {
  ctHash: bigint;
  securityZone: number;
  utype: number;
  signature: `0x${string}`;
};


type UseTokenTransferInput = {
  /** Token object with confidentialityType */
  token: Token;
  /** Recipient address */
  to: Address;
  /** Encrypted value struct (ctHash, securityZone, utype, signature) */
  encryptedValue: EncryptedValue;
  /** Amount being transferred (for transaction history) */
  amount: bigint;
};

type UseTokenTransferOptions = Omit<
  UseMutationOptions<`0x${string}`, Error, UseTokenTransferInput>,
  'mutationFn'
>;

/**
 * Hook to transfer encrypted tokens based on token confidentialityType
 * Uses token.extensions.fhenix.confidentialityType to determine the correct ABI and function
 * @param options - Optional React Query mutation options
 * @returns Mutation result with transaction hash
 */
export function useTokenTransfer(
  options?: UseTokenTransferOptions
): UseMutationResult<`0x${string}`, Error, UseTokenTransferInput> {
  const walletClient = useCofheWalletClient();
  const publicClient = useCofhePublicClient();
  const chainId = useCofheChainId();
  const account = useCofheAccount();
  const addTransaction = useTransactionStore((state) => state.addTransaction);
  const updateTransactionStatus = useTransactionStore((state) => state.updateTransactionStatus);

  return useMutation({
    mutationFn: async (input: UseTokenTransferInput) => {
      if (!walletClient) {
        throw new Error('WalletClient is required for token transfer');
      }

      const tokenAddress = input.token.address as Address;
      const confidentialityType = input.token.extensions.fhenix.confidentialityType;

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

      // Construct the inValue struct from encryptedValue (object format for viem)
      const inValue = {
        ctHash: input.encryptedValue.ctHash,
        securityZone: input.encryptedValue.securityZone,
        utype: input.encryptedValue.utype,
        signature: input.encryptedValue.signature,
      };

      const hash = await walletClient.writeContract({
        address: tokenAddress,
        abi: contractConfig.abi,
        functionName: contractConfig.functionName,
        args: [input.to, inValue],
        account: walletClient.account,
        chain: undefined,
      });

      // Record transaction in store
      if (chainId && account) {
        addTransaction({
          hash,
          tokenSymbol: input.token.symbol,
          tokenAmount: input.amount,
          tokenDecimals: input.token.decimals,
          tokenAddress: input.token.address,
          chainId,
          actionType: TransactionActionType.ShieldSend,
          account,
        });

        // Watch for transaction confirmation in background
        if (publicClient) {
          publicClient.waitForTransactionReceipt({ hash })
            .then((receipt) => {
              const status = receipt.status === 'success' 
                ? TransactionStatus.Confirmed 
                : TransactionStatus.Failed;
              updateTransactionStatus(chainId, hash, status);
            })
            .catch(() => {
              updateTransactionStatus(chainId, hash, TransactionStatus.Failed);
            });
        }
      }

      return hash;
    },
    ...options,
  });
}
