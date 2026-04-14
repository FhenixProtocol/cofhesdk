import { useCofheChainId } from '@/hooks/useCofheConnection';
import { PageContainer } from '../components/PageContainer';
import { FloatingButtonPage } from '../pagesConfig/types';
import { useCofheTokens } from '@/hooks';
import { TokenListContent } from '../modals/TokenListModal';
import { usePortalModals, usePortalNavigation } from '@/stores';
import { ArrowBackIcon } from '@/components/Icons';
import { BalanceType } from '../components/CofheTokenConfidentialBalance';
import { PortalModal } from '../modals/types';
import { AddCustomTokenButton } from '../modals/AddCustomTokenButton';

declare module '../pagesConfig/types' {
  interface FloatingButtonPagePropsRegistry {
    [FloatingButtonPage.Portfolio]: void;
  }
}
export const PortfolioPage: React.FC = () => {
  const { navigateBack, navigateTo } = usePortalNavigation();
  const { openModal } = usePortalModals();

  const chainId = useCofheChainId();
  const allTokens = useCofheTokens(chainId);

  return (
    <PageContainer
      header={
        <div className="flex justify-between flex-row">
          <button
            onClick={navigateBack}
            className="flex items-center gap-1 text-sm hover:opacity-80 transition-opacity"
          >
            <ArrowBackIcon style={{ fontSize: 16 }} />
            <p className="text-sm font-medium">Tokens list</p>
          </button>
          <AddCustomTokenButton
            onClick={() =>
              openModal(PortalModal.ImportCustomToken, {
                balanceType: BalanceType.Confidential,
                title: 'Import token',
                tokens: allTokens,
                onSelectToken: (token) => {
                  navigateTo(FloatingButtonPage.TokenInfo, {
                    pageProps: {
                      token,
                    },
                  });
                },
              })
            }
          />
        </div>
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
