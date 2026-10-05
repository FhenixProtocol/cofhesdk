import { getTaskManagerAddress } from '@cofhe/sdk';
import { useInternalQuery } from '@/providers';
import { useCofheChainId, useCofhePublicClient } from './useCofheConnection';

/**
 * Resolves the connected chain's Task Manager through the CoFHEAddressBook.
 * The SDK caches the resolution per chain, so this is one RPC call per chain per session.
 */
export function useCofheTaskManagerAddress() {
  const publicClient = useCofhePublicClient();
  const chainId = useCofheChainId();

  return useInternalQuery({
    queryKey: ['cofheTaskManagerAddress', chainId] as const,
    queryFn: async () => {
      if (!publicClient) throw new Error('PublicClient is required');
      return getTaskManagerAddress(publicClient, chainId);
    },
    enabled: !!publicClient && !!chainId,
    staleTime: Infinity,
  });
}
