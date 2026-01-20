import type { QueryClient } from '@tanstack/react-query';
import type { Address } from 'viem';

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
  blockNumber: bigint | undefined
) {
  const key = constructDecryptionTrackedBlockQueryKey(params);

  if (blockNumber === undefined) return;

  // Keep it monotonic so we never "go back" to an earlier block.
  queryClient.setQueryData<bigint | undefined>(key, (prev) => {
    if (prev === undefined) return blockNumber;
    return blockNumber > prev ? blockNumber : prev;
  });
}
