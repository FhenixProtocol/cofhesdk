import { type UseMutationOptions, type UseMutationResult } from '@tanstack/react-query';
import { type Address, type Hex } from 'viem';
import { useCofheWalletClient, useCofheChainId, useCofheAccount, useCofhePublicClient } from './useCofheConnection.js';
import { type Token } from './useCofheTokenLists.js';
import { assertTokenOperationSupported } from '@/types/token';
import { getClaimAllContractConfig, getClaimSingleContractConfig } from '../constants/confidentialTokenABIs.js';
import { TransactionActionType, useTransactionStore } from '../stores/transactionStore.js';
import { useInternalMutation } from '../providers/index.js';
import { assert } from 'ts-essentials';
import { useTransactionGlobalLifecycle } from './useTransactionGlobalLifecycle.js';
import type { CofheSimulateWriteContractCallArgs } from './useCofheSimulateWriteContract.js';
import { useCofheClient } from './useCofheClient.js';
import {
  constructUnshieldClaimsQueryKey,
  fetchUnshieldClaims,
  isTokenConfidentialityTypeClaimable,
  type UnshieldClaim,
} from './useCofheTokenClaimable.js';
import { cofheLogger } from '@/utils/debug';

export function getCofheTokenClaimUnshieldedCallArgs(params: {
  token: Token;
  account: Address;
  claim?: {
    ctHash: Hex | bigint;
    decryptedAmount: bigint;
    decryptionProof: `0x${string}`;
  };
}): CofheSimulateWriteContractCallArgs {
  const { token, account, claim } = params;

  const tokenAddress: Address = token.address;
  const confidentialityType = token.extensions.fhenix.confidentialityType;

  if (!confidentialityType) {
    throw new Error('confidentialityType is required in token extensions');
  }

  assertTokenOperationSupported(confidentialityType, 'claim');

  if (confidentialityType === 'dual') {
    assert(claim, 'dual claim requires ctHash, decryptedAmount, and decryptionProof');
    const contractConfig = getClaimSingleContractConfig(confidentialityType);

    return {
      address: tokenAddress,
      abi: contractConfig.abi,
      functionName: contractConfig.functionName,
      args: [claim.ctHash, claim.decryptedAmount, claim.decryptionProof],
      account,
      chain: undefined,
    };
  }

  const contractConfig = getClaimAllContractConfig(confidentialityType);

  return {
    address: tokenAddress,
    abi: contractConfig.abi,
    functionName: contractConfig.functionName,
    args: [],
    account,
    chain: undefined,
  };
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
 * Hook to claim unshielded tokens after decryption completes
 * Wrapped tokens call `claimAllDecrypted()`.
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

      const tokenAddress: Address = input.token.address;
      const confidentialityType = input.token.extensions.fhenix.confidentialityType;

      if (!confidentialityType) {
        throw new Error('confidentialityType is required in token extensions');
      }

      if (!walletClient.account) {
        throw new Error('Wallet account is required for claim');
      }

      assertTokenOperationSupported(confidentialityType, 'claim');

      if (confidentialityType === 'dual') {
        assert(chainId, 'Chain ID is required for dual claim');
        assert(account, 'Wallet account is required for dual claim');
        assert(isTokenConfidentialityTypeClaimable(confidentialityType), 'dual claim type must be claimable');

        input.token.extensions.fhenix.confidentialityType;

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
            input.token;
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
              isPendingDecryption: false,
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

      const contractConfig = getClaimAllContractConfig(confidentialityType);

      const { request } = await publicClient.simulateContract({
        address: tokenAddress,
        abi: contractConfig.abi,
        functionName: contractConfig.functionName,
        args: [],
        account: walletClient.account,
      });
      return await walletClient.writeContract({ ...request, chain: undefined });
    },
    onError: (error, variables, onMutateResult, context) => {
      if (onError) onError(error, variables, onMutateResult, context);
      onTransactionSubmitError(error, TransactionActionType.Claim);
    },
    onSuccess: async (hash, input, onMutateResult, context) => {
      assert(chainId, 'Chain ID is required for claim');
      assert(account, 'Wallet account is required for claim');
      if (onSuccess) await onSuccess(hash, input, onMutateResult, context);

      if (input.token.extensions.fhenix.confidentialityType === 'dual') {
        return;
      }

      useTransactionStore.getState().addTransaction({
        hash,

        token: input.token,
        tokenAmount: input.amount,

        chainId,
        actionType: TransactionActionType.Claim,
        isPendingDecryption: false, // doesn't need decryption afterwards
        account,
      });
    },
    ...restOfOptions,
  });
}
