import { PageContainer } from '../components/PageContainer';
import { PortalModal, type PortalModalStateMap } from './types';
import { useCofheChainId } from '@/hooks/useCofheConnection';
import { type Token, useCofheTokens } from '@/hooks';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import { type TokenListMode } from '../FnxFloatingButtonContext';
import { TokenRow } from '../pages/TokenListPage/TokenRow';

export type TokenListModalProps = {
  title?: string;
  mode: TokenListMode;
  onSelectToken: (token: Token) => void;
};

export const TokenListModal: React.FC<PortalModalStateMap[PortalModal.TokenList]> = ({
  // modal,
  onClose,
  mode,
  title,
  onSelectToken,
}) => {
  const chainId = useCofheChainId();
  const allTokens = useCofheTokens(chainId);

  const defaultTitle = mode === 'select' ? 'Select token to transfer' : 'Token List';
  const pageTitle = title ?? defaultTitle;

  return (
    <PageContainer
      header={
        <button onClick={onClose} className="flex items-center gap-1 text-sm hover:opacity-80 transition-opacity">
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
                  onSelectToken(token);
                  onClose();
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
