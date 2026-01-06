import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import { useFnxFloatingButtonContext } from '../FnxFloatingButtonContext.js';
import { useCofheTokens } from '../../../hooks/useCofheTokenLists.js';
import { useCofheChainId } from '../../../hooks/useCofheConnection.js';
import { TokenRow } from './TokenListPage/TokenRow.js';

export const TokenListPage: React.FC<{ title?: string }> = ({ title }) => {
  const { navigateBack, tokenListMode } = useFnxFloatingButtonContext();
  const chainId = useCofheChainId();
  const allTokens = useCofheTokens(chainId);

  const defaultTitle = tokenListMode === 'select' ? 'Select token to transfer' : 'Token List';
  const pageTitle = title ?? defaultTitle;

  return (
    <div className="fnx-text-primary space-y-3">
      <button onClick={navigateBack} className="flex items-center gap-1 text-sm hover:opacity-80 transition-opacity">
        <ArrowBackIcon style={{ fontSize: 16 }} />
        <p className="text-sm font-medium">{pageTitle}</p>
      </button>

      <div className="fnx-token-list-container">
        {allTokens.length === 0 ? (
          <p className="text-xs opacity-70 py-4 text-center">No tokens found</p>
        ) : (
          allTokens.map((token) => <TokenRow key={token.address} token={token} mode={tokenListMode} />)
        )}
      </div>
    </div>
  );
};
