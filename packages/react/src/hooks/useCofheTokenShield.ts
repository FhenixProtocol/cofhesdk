import { useMutation, useQuery, type UseMutationOptions, type UseMutationResult, type UseQueryOptions, type UseQueryResult } from '@tanstack/react-query';
import { type Address } from 'viem';
import { useCofheWalletClient, useCofheChainId, useCofheAccount, useCofhePublicClient } from './useCofheConnection.js';
import { useCofheContext } from '../providers/index.js';
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
import { addTransactionAndWatch, TransactionActionType } from '../stores/transactionStore.js';

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

type UseTokenUnshieldInput = {
  /** Token object with confidentialityType */
  token: Token;
  /** Amount to unshield (in token's smallest unit, uint64 max for dual) */
  amount: bigint;
  /** Optional callback for status updates during the operation */
  onStatusChange?: (message: string) => void;
};

type UseClaimUnshieldInput = {
  /** Token object with confidentialityType */
  token: Token;
  /** Amount being claimed (for activity logging) */
  amount?: bigint;
};

type UseTokenShieldOptions = Omit<UseMutationOptions<`0x${string}`, Error, UseTokenShieldInput>, 'mutationFn'>;
type UseTokenUnshieldOptions = Omit<UseMutationOptions<`0x${string}`, Error, UseTokenUnshieldInput>, 'mutationFn'>;
type UseClaimUnshieldOptions = Omit<UseMutationOptions<`0x${string}`, Error, UseClaimUnshieldInput>, 'mutationFn'>;

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
  const { recordTransactionHistory } = useCofheContext().config.react;

  return useMutation({
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

      // Record transaction and watch for confirmation
      if (chainId && account) {
        addTransactionAndWatch(
          {
            hash,
            tokenSymbol: input.token.symbol,
            tokenAmount: input.amount,
            tokenDecimals: input.token.decimals,
            tokenAddress: input.token.address,
            chainId,
            actionType: TransactionActionType.Shield,
            account,
          },
          publicClient,
          recordTransactionHistory
        );
      }

      return hash;
    },
    ...options,
  });
}

// ============================================================================
// Unshield Hook
// ============================================================================

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
  const publicClient = useCofhePublicClient();
  const chainId = useCofheChainId();
  const account = useCofheAccount();
  const { recordTransactionHistory } = useCofheContext().config.react;

  return useMutation({
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

      // Record transaction and watch for confirmation
      if (chainId && account) {
        addTransactionAndWatch(
          {
            hash,
            tokenSymbol: input.token.symbol,
            tokenAmount: input.amount,
            tokenDecimals: input.token.decimals,
            tokenAddress: input.token.address,
            chainId,
            actionType: TransactionActionType.Unshield,
            account,
          },
          publicClient,
          recordTransactionHistory
        );
      }

      return hash;
    },
    ...options,
  });
}

// ============================================================================
// Claim Unshield Hook
// ============================================================================

/**
 * Hook to claim unshielded tokens after decryption completes
 * - Dual tokens: calls `claimUnshielded()`
 * - Wrapped tokens: calls `claimAllDecrypted()`
 * @param options - Optional React Query mutation options
 * @returns Mutation result with transaction hash
 */
export function useCofheClaimUnshield(
  options?: UseClaimUnshieldOptions
): UseMutationResult<`0x${string}`, Error, UseClaimUnshieldInput> {
  const walletClient = useCofheWalletClient();
  const publicClient = useCofhePublicClient();
  const chainId = useCofheChainId();
  const account = useCofheAccount();
  const { recordTransactionHistory } = useCofheContext().config.react;

  return useMutation({
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

      // Record transaction and watch for confirmation
      if (chainId && account && input.amount !== undefined) {
        addTransactionAndWatch(
          {
            hash,
            tokenSymbol: input.token.symbol,
            tokenAmount: input.amount,
            tokenDecimals: input.token.decimals,
            tokenAddress: input.token.address,
            chainId,
            actionType: TransactionActionType.Claim,
            account,
          },
          publicClient,
          recordTransactionHistory
        );
      }

      return hash;
    },
    ...options,
  });
}

// ============================================================================
// Unified Unshield Claims Hook
// ============================================================================

/**
 * Unified unshield claims summary - works for both dual and wrapped tokens
 */
export type UnshieldClaimsSummary = {
  /** Total amount that can be claimed now (decrypted and not claimed) */
  claimableAmount: bigint;
  /** Total amount pending decryption */
  pendingAmount: bigint;
  /** Whether there are any claimable amounts */
  hasClaimable: boolean;
  /** Whether there are any pending (not yet decrypted) claims */
  hasPending: boolean;
};

type UseUnshieldClaimsInput = {
  /** Token object with confidentialityType */
  token: Token | null;
  /** Account address (optional, defaults to connected account) */
  accountAddress?: Address;
};

type UseUnshieldClaimsOptions = Omit<UseQueryOptions<UnshieldClaimsSummary, Error>, 'queryKey' | 'queryFn'>;

/**
 * Unified hook to fetch unshield claims for any token type (dual or wrapped)
 * @param input - Token object and optional account address
 * @param queryOptions - Optional React Query options
 * @returns Query result with UnshieldClaimsSummary
 */
export function useCofheUnshieldClaims(
  input: UseUnshieldClaimsInput,
  queryOptions?: UseUnshieldClaimsOptions
): UseQueryResult<UnshieldClaimsSummary, Error> {
  const publicClient = useCofhePublicClient();
  const connectedAccount = useCofheAccount();
  const account = input.accountAddress || (connectedAccount as Address | undefined);

  const token = input.token;
  const tokenAddress = token?.address as Address | undefined;
  const confidentialityType = token?.extensions.fhenix.confidentialityType;

  return useQuery({
    queryKey: ['unshieldClaims', tokenAddress, confidentialityType, account],
    queryFn: async (): Promise<UnshieldClaimsSummary> => {
      if (!publicClient) {
        throw new Error('PublicClient is required to fetch unshield claims');
      }
      if (!account) {
        throw new Error('Account address is required to fetch unshield claims');
      }
      if (!tokenAddress) {
        throw new Error('Token address is required');
      }

      if (confidentialityType === 'dual') {
        // Dual tokens: single claim via getUserUnshieldClaim
        const result = await publicClient.readContract({
          address: tokenAddress,
          abi: DUAL_GET_UNSHIELD_CLAIM_ABI,
          functionName: 'getUserUnshieldClaim',
          args: [account],
        });

        const claim = result as {
          ctHash: bigint;
          requestedAmount: bigint;
          decryptedAmount: bigint;
          decrypted: boolean;
          claimed: boolean;
        };

        // No active claim
        if (claim.ctHash === 0n || claim.claimed) {
          return {
            claimableAmount: 0n,
            pendingAmount: 0n,
            hasClaimable: false,
            hasPending: false,
          };
        }

        return {
          claimableAmount: claim.decrypted ? claim.decryptedAmount : 0n,
          pendingAmount: claim.decrypted ? 0n : claim.requestedAmount,
          hasClaimable: claim.decrypted,
          hasPending: !claim.decrypted,
        };
      } else if (confidentialityType === 'wrapped') {
        // Wrapped tokens: multiple claims via getUserClaims
        const result = await publicClient.readContract({
          address: tokenAddress,
          abi: WRAPPED_GET_USER_CLAIMS_ABI,
          functionName: 'getUserClaims',
          args: [account],
        });

        type WrappedClaimResult = {
          ctHash: bigint;
          requestedAmount: bigint;
          decryptedAmount: bigint;
          decrypted: boolean;
          to: Address;
          claimed: boolean;
        };

        const claims = (result as WrappedClaimResult[]).filter(c => !c.claimed);

        let claimableAmount = 0n;
        let pendingAmount = 0n;

        for (const claim of claims) {
          if (claim.decrypted) {
            claimableAmount += claim.decryptedAmount;
          } else {
            pendingAmount += claim.requestedAmount;
          }
        }

        return {
          claimableAmount,
          pendingAmount,
          hasClaimable: claimableAmount > 0n,
          hasPending: pendingAmount > 0n,
        };
      }

      // Token type doesn't support claims
      return {
        claimableAmount: 0n,
        pendingAmount: 0n,
        hasClaimable: false,
        hasPending: false,
      };
    },
    enabled: !!publicClient && !!account && !!tokenAddress && (confidentialityType === 'dual' || confidentialityType === 'wrapped'),
    ...queryOptions,
  });
}

