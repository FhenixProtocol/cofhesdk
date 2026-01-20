import type { QueryClient } from '@tanstack/react-query';
import type { Address } from 'viem';

export type DecryptionTrackedBlock = {
  blockNumber: bigint;
  blockHash?: `0x${string}`;
  decryptionReceipt?: any;
};

export function constructDecryptionTrackedBlockQueryKey(params: {
  chainId: number | undefined;
  accountAddress: Address | undefined;
}) {
  return ['decryptionTrackedBlock', params.chainId, params.accountAddress] as const;
}

export function setDecryptionTrackedBlock(
  queryClient: QueryClient,
  params: {
    chainId: number;
    accountAddress: Address;
  },
  tracked: DecryptionTrackedBlock | undefined
) {
  const key = constructDecryptionTrackedBlockQueryKey(params);

  if (tracked === undefined) return;

  // Keep it monotonic so we never "go back" to an earlier block.
  queryClient.setQueryData<DecryptionTrackedBlock | undefined>(key, (prev) => {
    if (prev === undefined) return tracked;
    return tracked.blockNumber > prev.blockNumber ? tracked : prev;
  });
}
