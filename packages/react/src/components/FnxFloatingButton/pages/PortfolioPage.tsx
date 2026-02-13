import { useCofheChainId } from '@/hooks/useCofheConnection';
import { PageContainer } from '../components/PageContainer';
import { FloatingButtonPage } from '../pagesConfig/types';
import { useCofheTokens } from '@/hooks';
import { TokenListContent } from '../modals/TokenListModal';
import { usePortalNavigation } from '@/stores';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import { BalanceType } from '../components/CofheTokenConfidentialBalance';

declare module '../pagesConfig/types' {
  interface FloatingButtonPagePropsRegistry {
    [FloatingButtonPage.Portfolio]: void;
  }
}
export const PortfolioPage: React.FC = () => {
  const { navigateBack, navigateTo } = usePortalNavigation();

  const chainId = useCofheChainId();
  const allTokens = useCofheTokens(chainId);

  return (
    <PageContainer
      header={
        <button onClick={navigateBack} className="flex items-center gap-1 text-sm hover:opacity-80 transition-opacity">
          <ArrowBackIcon style={{ fontSize: 16 }} />
          <p className="text-sm font-medium">Tokens list</p>
        </button>
      }
      content={
        <TokenListContent
          balanceType={BalanceType.Confidential}
          tokens={allTokens}
          onSelectToken={(token) => {
            navigateTo(FloatingButtonPage.TokenInfo, {
              pageProps: {
                token,
              },
            });
          }}
        />
      }
    />
  );
};
