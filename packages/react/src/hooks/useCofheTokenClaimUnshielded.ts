import { assertTokenOperationSupported } from '@/types/token';
import { cofheLogger } from '@/utils/debug';
import { type UseMutationOptions, type UseMutationResult } from '@tanstack/react-query';
import { assert } from 'ts-essentials';
import { type Address, type Hex } from 'viem';
import { buildTokenClaimCallArgs, getTokenTypeConfig } from '../constants/tokenTypeConfig';
import { useInternalMutation } from '../providers/index';
import { TransactionActionType, useTransactionStore } from '../stores/transactionStore';
import { useCofheClient } from './useCofheClient';
import { useCofheAccount, useCofheChainId, useCofhePublicClient, useCofheWalletClient } from './useCofheConnection';
import type { CofheSimulateWriteContractCallArgs } from './useCofheSimulateWriteContract';
import { fetchUnshieldClaims, isTokenConfidentialityTypeClaimable } from './useCofheTokenClaimable';
import { type ConfidentialToken } from './useCofheTokenLists';
import { useTransactionGlobalLifecycle } from './useTransactionGlobalLifecycle';

export function getCofheTokenClaimUnshieldedCallArgs(params: {
  token: ConfidentialToken;
  account: Address;
  claim?: {
    ctHash: Hex | bigint;
    decryptedAmount: bigint;
    decryptionProof: `0x${string}`;
  };
  claims?: Array<{
    ctHash: Hex | bigint;
    decryptedAmount: bigint;
    decryptionProof: `0x${string}`;
  }>;
}): CofheSimulateWriteContractCallArgs | undefined {
  const { token, account, claim, claims } = params;

  const confidentialityType = token.extensions.fhenix.confidentialityType;

  if (!confidentialityType) {
    throw new Error('confidentialityType is required in token extensions');
  }

  assertTokenOperationSupported(confidentialityType, 'claim');

  return buildTokenClaimCallArgs({
    token,
    account,
    claim,
    claims,
  }) as CofheSimulateWriteContractCallArgs | undefined;
}

// ============================================================================
// Claim Unshield Hook
// ============================================================================
type UseClaimUnshieldInput = {
  /** Token object with confidentialityType */
  token: ConfidentialToken;
  /** Amount being claimed (for activity logging) */
  amount: bigint;
};
type UseClaimUnshieldOptions = Omit<UseMutationOptions<`0x${string}`, Error, UseClaimUnshieldInput>, 'mutationFn'>;
/**
 * Hook to claim unshielded tokens after decryption completes.
 * @param options - Optional React Query mutation options
 * @returns Mutation result with transaction hash
 */
export function useCofheTokenClaimUnshielded(
  options?: UseClaimUnshieldOptions
): UseMutationResult<`0x${string}`, Error, UseClaimUnshieldInput> {
  const walletClient = useCofheWalletClient();
  const publicClient = useCofhePublicClient();
  const client = useCofheClient();
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

      const confidentialityType = input.token.extensions.fhenix.confidentialityType;

      if (!confidentialityType) {
        throw new Error('confidentialityType is required in token extensions');
      }

      if (!walletClient.account) {
        throw new Error('Wallet account is required for claim');
      }

      assert(chainId, 'Chain ID is required for claim');
      assert(account, 'Wallet account is required for claim');
      assertTokenOperationSupported(confidentialityType, 'claim');

      const tokenConfig = getTokenTypeConfig(confidentialityType);
      const claimKind = tokenConfig.claimSubmission === 'single' ? 'dual' : 'wrapped';

      const fetchReadyClaims = async () => {
        const claims = await fetchUnshieldClaims({
          publicClient,
          token: input.token,
          accountAddress: account,
          confidentialityType,
          signal: new AbortController().signal,
        });

        const readyClaims: Array<{
          ctHash: Hex | bigint;
          decryptedAmount: bigint;
          decryptionProof: `0x${string}`;
        }> = [];

        for (const claim of claims.filter((claim) => !claim.claimed)) {
          try {
            const decryptResult = await client
              .decryptForTx(claim.ctHash)
              .setChainId(chainId)
              .setAccount(account)
              .withoutPermit()
              .execute();

            readyClaims.push({
              ctHash: claim.ctHash,
              decryptedAmount: decryptResult.decryptedValue,
              decryptionProof: decryptResult.signature,
            });
          } catch (error) {
            cofheLogger.warn(`Skipping ${claimKind} claim that is not yet ready or failed to prove`, {
              ctHash: claim.ctHash.toString(),
              error,
            });
          }
        }

        if (readyClaims.length === 0) {
          throw new Error(`No ${claimKind} unshield claims are ready to be claimed yet.`);
        }

        return readyClaims;
      };

      const writeClaim = async (callArgs: CofheSimulateWriteContractCallArgs) => {
        const { request } = await publicClient.simulateContract({
          ...callArgs,
          account: walletClient.account,
        });

        return walletClient.writeContract({ ...request, chain: undefined });
      };

      const trackClaim = (hash: `0x${string}`, tokenAmount: bigint) => {
        useTransactionStore.getState().addTransaction({
          hash,
          token: input.token,
          tokenAmount,
          chainId,
          actionType: TransactionActionType.Claim,
          account,
        });
      };

      // logic goes here
      const readyClaims = await fetchReadyClaims();

      if (tokenConfig.claimSubmission === 'single') {
        // claim one by one
        assert(isTokenConfidentialityTypeClaimable(confidentialityType), 'dual claim type must be claimable');

        const submittedHashes = [] as `0x${string}`[];

        for (const claim of readyClaims) {
          const callArgs = getCofheTokenClaimUnshieldedCallArgs({
            token: input.token,
            account: walletClient.account.address,
            claim,
          });

          assert(callArgs, 'Dual claim call args are required when a claim proof is available');

          const hash = await writeClaim(callArgs);
          submittedHashes.push(hash);
          // track one by one
          trackClaim(hash, claim.decryptedAmount);
        }

        return submittedHashes[submittedHashes.length - 1];
      }

      // batched claim
      const callArgs = getCofheTokenClaimUnshieldedCallArgs({
        token: input.token,
        account: walletClient.account.address,
        claims: readyClaims,
      });

      assert(callArgs, 'Wrapped claim call args are required when claim proofs are available');

      const hash = await writeClaim(callArgs);

      // track just one batched tx
      trackClaim(hash, input.amount);

      return hash;
    },
    onError: (error, variables, onMutateResult, context) => {
      if (onError) onError(error, variables, onMutateResult, context);
      onTransactionSubmitError(error, TransactionActionType.Claim);
    },
    onSuccess,
    ...restOfOptions,
  });
}
