import { useCofheAccount, useCofheChainId } from './useCofheConnection';
import { useCofheTokens } from './useCofheTokenLists';
import { useCofheTokensClaimable } from './useCofheTokensClaimable';

export function useCofheClaimableTokens() {
  const account = useCofheAccount();
  const chainId = useCofheChainId();
  const allTokens = useCofheTokens(chainId);
  const result = useCofheTokensClaimable({
    accountAddress: account,
    tokens: allTokens,
  });

  return result;
}
