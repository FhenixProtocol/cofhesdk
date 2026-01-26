import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import { type TokenListMode } from '../FnxFloatingButtonContext.js';
import { useCofheTokens } from '@/hooks/useCofheTokenLists.js';
import { useCofheChainId } from '@/hooks/useCofheConnection.js';
import { TokenRow } from './TokenListPage/TokenRow.js';
import { isPageWithProps, type FloatingButtonPage, type PageState } from '../pagesConfig/types.js';
import { assert } from 'ts-essentials';
import { usePortalNavigation } from '@/stores';
import { PageContainer } from '../components/PageContainer.js';

type PageStateWithoutTokenProp = Omit<PageState, 'props'> & { props?: Omit<PageState['props'], 'token'> };

type TokenListPageProps = { title?: string; backToPageState: PageStateWithoutTokenProp; mode: TokenListMode };

declare module '../pagesConfig/types' {
  interface FloatingButtonPagePropsRegistry {
    [FloatingButtonPage.TokenList]: TokenListPageProps;
  }
}

export const TokenListPage: React.FC<TokenListPageProps> = ({ title, backToPageState, mode: tokenListMode }) => {
  const { navigateBack, navigateTo } = usePortalNavigation();
  const chainId = useCofheChainId();
  const allTokens = useCofheTokens(chainId);

  const defaultTitle = tokenListMode === 'select' ? 'Select token to transfer' : 'Token List';
  const pageTitle = title ?? defaultTitle;

  return (
    <PageContainer
      header={
        <button onClick={navigateBack} className="flex items-center gap-1 text-sm hover:opacity-80 transition-opacity">
          <ArrowBackIcon style={{ fontSize: 16 }} />
          <p className="text-sm font-medium">{pageTitle}</p>
        </button>
      }
    >
      <div className="fnx-token-list-container">
        {allTokens.length === 0 ? (
          <p className="text-xs opacity-70 py-4 text-center">No tokens found</p>
        ) : (
          allTokens.map((token) => (
            <TokenRow
              onClick={() => {
                assert(isPageWithProps(backToPageState.page), 'backToPageState must be a page with props');
                navigateTo(backToPageState.page, { pageProps: { ...backToPageState.props, token } });
              }}
              key={token.address}
              token={token}
            />
          ))
        )}
      </div>
    </PageContainer>
  );
};
