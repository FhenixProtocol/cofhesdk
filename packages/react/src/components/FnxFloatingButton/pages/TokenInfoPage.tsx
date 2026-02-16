import { type Token } from '@/hooks/useCofheTokenLists';
import { useCoingeckoContractMarketChartRange } from '@/hooks';
import { FloatingButtonPage } from '../pagesConfig/types';
import { usePortalNavigation } from '@/stores';
import { TokenDetailsView } from '../components/TokenDetailsView';
import { sepolia } from '@cofhe/sdk/chains';
import { TMP_WBTC_ON_MAINNET } from '@/utils/coingecko';

type TokenInfoPageProps = {
  token: Token;
};

declare module '../pagesConfig/types' {
  interface FloatingButtonPagePropsRegistry {
    [FloatingButtonPage.TokenInfo]: TokenInfoPageProps;
  }
}

export const TokenInfoPage: React.FC<TokenInfoPageProps> = ({ token }) => {
  const { navigateBack } = usePortalNavigation();

  const { data: chartPoints } = useCoingeckoContractMarketChartRange({
    ...(token.chainId === sepolia.id
      ? {
          chainId: TMP_WBTC_ON_MAINNET.chainId,
          contractAddress: TMP_WBTC_ON_MAINNET.address,
        }
      : {
          chainId: token.chainId,
          contractAddress: token.extensions.fhenix.erc20Pair?.address,
        }),
    rangeMs: 24 * 3600_000,
  });

  return <TokenDetailsView token={token} onBack={navigateBack} chartPoints={chartPoints ?? []} />;
};
