import { useCofheContext } from '@/providers';
import { useCofheChainId } from './useCofheConnection';

/**
 * Hook to get pinned token address for the current chain
 * @returns Pinned token address for current chain, or undefined if none
 */
export function useCofhePinnedTokenAddress() {
  const widgetConfig = useCofheContext().client.config.react;
  const chainId = useCofheChainId();
  const pinnedTokenAddress = chainId ? widgetConfig.pinnedTokens[chainId?.toString()] : undefined;
  return pinnedTokenAddress;
}
