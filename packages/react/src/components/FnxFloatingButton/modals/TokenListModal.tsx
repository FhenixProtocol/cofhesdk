import { usePortalModals, usePortalNavigation } from '@/stores';
import { PageContainer } from '../components/PageContainer';
import { PortalModal, type PortalModalStateMap } from './types';
import { useCofheChainId } from '@/hooks/useCofheConnection';
import { useCofheTokens } from '@/hooks';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import { type TokenListMode } from '../FnxFloatingButtonContext.js';

import { isPageWithProps, type FloatingButtonPage, type PageState } from '../pagesConfig/types.js';
import { assert } from 'ts-essentials';
import { TokenRow } from '../pages/TokenListPage/TokenRow';

export const TokenListModal: React.FC<PortalModalStateMap[PortalModal.TokenList]> = ({
  mode,
  title,
  backToPageState,
}) => {
  const { navigateTo } = usePortalNavigation();
  const { closeModal } = usePortalModals();
  const chainId = useCofheChainId();
  const allTokens = useCofheTokens(chainId);

  const defaultTitle = mode === 'select' ? 'Select token to transfer' : 'Token List';
  const pageTitle = title ?? defaultTitle;

  return (
    <PageContainer
      header={
        <button
          onClick={() => closeModal(PortalModal.TokenList)}
          className="flex items-center gap-1 text-sm hover:opacity-80 transition-opacity"
        >
          <ArrowBackIcon style={{ fontSize: 16 }} />
          <p className="text-sm font-medium">{pageTitle}</p>
        </button>
      }
      content={
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
      }
    />
  );
};
