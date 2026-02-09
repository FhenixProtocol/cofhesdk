import { useCofhePinnedTokenAddress } from './useCofhePinnedTokenAddress';
import { useCofheToken } from './useCofheTokenLists';

export function useCofhePinnedToken({ enabled }: { enabled?: boolean } = {}) {
  const pinnedTokenAddress = useCofhePinnedTokenAddress();
  const token = useCofheToken(
    {
      address: pinnedTokenAddress,
    },
    {
      // only fetch metadata if pinned token address is defined
      enabled: enabled !== false && !!pinnedTokenAddress,
    }
  );
  return token;
}
