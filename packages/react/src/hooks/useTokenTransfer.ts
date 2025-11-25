/* Placeholder hook for token transfer, didn't used it yet, code needs to be updated */
import { useMutation, type UseMutationOptions, type UseMutationResult } from '@tanstack/react-query';
import type { Address, Abi } from 'viem';
import { parseAbi } from 'viem';
import { useCofhePublicClient, useCofheWalletClient } from './useCofheConnection.js';
import { detectContractType, getSelectorsFromAbi } from './useTokenContractDetection.js';

// ABIs for the three token types
const TYPE_A_ABI = parseAbi(['function transfer(address to, uint256 amount) returns (bool)']);
const TYPE_B_ABI = parseAbi(['function sendTokens(address to, uint256 amount, uint256 nonce) returns (bool)']);
const TYPE_C_ABI = parseAbi(['function customTransfer(address to, uint256 amount) returns (bool)']);

type UseTokenTransferInput = {
  /** Token contract address */
  tokenAddress: Address;
  /** Recipient address */
  to: Address;
  /** Amount to transfer (in token's smallest unit, e.g., wei) */
  amount: bigint;
};

type UseTokenTransferOptions = Omit<
  UseMutationOptions<`0x${string}`, Error, UseTokenTransferInput>,
  'mutationFn'
>;

const TRANSFER_TYPE_SELECTORS = {
  TypeA: (abi: Abi) => getSelectorsFromAbi(abi, ['transfer']),
  TypeB: (abi: Abi) => getSelectorsFromAbi(abi, ['sendTokens']),
  TypeC: (abi: Abi) => getSelectorsFromAbi(abi, ['customTransfer']),
};

const TRANSFER_ABIS = {
  TypeA: TYPE_A_ABI,
  TypeB: TYPE_B_ABI,
  TypeC: TYPE_C_ABI,
};

/**
 * Hook to transfer tokens from different contract types without knowing the specific type
 * Automatically detects the token type (TypeA, TypeB, or TypeC) and calls the appropriate transfer method
 * @param options - Optional React Query mutation options
 * @returns Mutation result with transaction hash
 */
export function useTokenTransfer(
  options?: UseTokenTransferOptions
): UseMutationResult<`0x${string}`, Error, UseTokenTransferInput> {
  const publicClient = useCofhePublicClient();
  const walletClient = useCofheWalletClient();

  return useMutation({
    mutationFn: async (input: UseTokenTransferInput) => {
      if (!publicClient) {
        throw new Error('PublicClient is required for token transfer');
      }
      if (!walletClient) {
        throw new Error('WalletClient is required for token transfer');
      }

      const type = await detectContractType(
        input.tokenAddress,
        publicClient,
        TRANSFER_TYPE_SELECTORS,
        TRANSFER_ABIS
      );

      if (!type) {
        throw new Error(`Unknown token type for ${input.tokenAddress}. Could not detect TypeA, TypeB, or TypeC.`);
      }

      switch (type) {
        case 'TypeA': {
          const hash = await walletClient.writeContract({
            address: input.tokenAddress,
            abi: TYPE_A_ABI,
            functionName: 'transfer',
            args: [input.to, input.amount],
          } as any);
          return hash;
        }
        case 'TypeB': {
          const hash = await walletClient.writeContract({
            address: input.tokenAddress,
            abi: TYPE_B_ABI,
            functionName: 'sendTokens',
            args: [input.to, input.amount, 0n],
          } as any);
          return hash;
        }
        case 'TypeC': {
          const hash = await walletClient.writeContract({
            address: input.tokenAddress,
            abi: TYPE_C_ABI,
            functionName: 'customTransfer',
            args: [input.to, input.amount],
          } as any);
          return hash;
        }
        default:
          throw new Error(`Unknown token type: ${type}`);
      }
    },
    ...options,
  });
}

