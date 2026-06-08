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
import { fetchUnshieldClaims, isTokenConfidentialityTypeClaimable, type UnshieldClaim } from './useCofheTokenClaimable';
import { type Token } from './useCofheTokenLists';
import { useTransactionGlobalLifecycle } from './useTransactionGlobalLifecycle';

export function getCofheTokenClaimUnshieldedCallArgs(params: {
  token: Token;
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
  token: Token;
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

      assertTokenOperationSupported(confidentialityType, 'claim');

      if (getTokenTypeConfig(confidentialityType).claimSubmission === 'single') {
        assert(chainId, 'Chain ID is required for dual claim');
        assert(account, 'Wallet account is required for dual claim');
        assert(isTokenConfidentialityTypeClaimable(confidentialityType), 'dual claim type must be claimable');

        const claims = await fetchUnshieldClaims({
          publicClient,
          token: input.token,
          accountAddress: account,
          confidentialityType,
          signal: new AbortController().signal,
        });

        const pendingClaims = claims.filter((claim) => !claim.claimed);
        const submitted: Array<{ hash: `0x${string}`; claim: UnshieldClaim; decryptedAmount: bigint }> = [];

        for (const claim of pendingClaims) {
          try {
            const decryptResult = await client
              .decryptForTx(claim.ctHash)
              .setChainId(chainId)
              .setAccount(account)
              .withoutPermit()
              .execute();

            const callArgs = getCofheTokenClaimUnshieldedCallArgs({
              token: input.token,
              account: walletClient.account.address,
              claim: {
                ctHash: claim.ctHash,
                decryptedAmount: decryptResult.decryptedValue,
                decryptionProof: decryptResult.signature,
              },
            });

            assert(callArgs, 'Dual claim call args are required when a claim proof is available');

            const { request } = await publicClient.simulateContract({
              ...callArgs,
              account: walletClient.account,
            });
            const hash = await walletClient.writeContract({ ...request, chain: undefined });

            submitted.push({ hash, claim, decryptedAmount: decryptResult.decryptedValue });
            useTransactionStore.getState().addTransaction({
              hash,
              token: input.token,
              tokenAmount: decryptResult.decryptedValue,
              chainId,
              actionType: TransactionActionType.Claim,
              account,
            });
          } catch (error) {
            cofheLogger.warn('Skipping dual claim that is not yet ready or failed to prove', {
              ctHash: claim.ctHash.toString(),
              error,
            });
          }
        }

        if (submitted.length === 0) {
          throw new Error('No dual unshield claims are ready to be claimed yet.');
        }

        return submitted[submitted.length - 1].hash;
      }

      assert(chainId, 'Chain ID is required for wrapped claim');
      assert(account, 'Wallet account is required for wrapped claim');

      const claims = await fetchUnshieldClaims({
        publicClient,
        token: input.token,
        accountAddress: account,
        confidentialityType,
        signal: new AbortController().signal,
      });

      const pendingClaims = claims.filter((claim) => !claim.claimed);
      const submitted = [] as Array<{
        ctHash: Hex | bigint;
        decryptedAmount: bigint;
        decryptionProof: `0x${string}`;
      }>;

      for (const currentClaim of pendingClaims) {
        try {
          const decryptResult = await client
            .decryptForTx(currentClaim.ctHash)
            .setChainId(chainId)
            .setAccount(account)
            .withoutPermit()
            .execute();

          submitted.push({
            ctHash: currentClaim.ctHash,
            decryptedAmount: decryptResult.decryptedValue,
            decryptionProof: decryptResult.signature,
          });
        } catch (error) {
          cofheLogger.warn('Skipping wrapped claim that is not yet ready or failed to prove', {
            ctHash: currentClaim.ctHash.toString(),
            error,
          });
        }
      }

      if (submitted.length === 0) {
        throw new Error('No wrapped unshield claims are ready to be claimed yet.');
      }

      const callArgs = getCofheTokenClaimUnshieldedCallArgs({
        token: input.token,
        account: walletClient.account.address,
        claims: submitted,
      });

      if (!callArgs) {
        throw new Error('Wrapped claim call args are required when claim proofs are available');
      }

      const { request } = await publicClient.simulateContract({
        ...callArgs,
        account: walletClient.account,
      });
      const hash = await walletClient.writeContract({ ...request, chain: undefined });

      useTransactionStore.getState().addTransaction({
        hash,
        token: input.token,
        tokenAmount: input.amount,
        chainId,
        actionType: TransactionActionType.Claim,
        account,
      });

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
