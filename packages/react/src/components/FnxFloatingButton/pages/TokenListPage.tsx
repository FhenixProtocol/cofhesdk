import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import { useFnxFloatingButtonContext, type NativeToken } from '../FnxFloatingButtonContext.js';
import { useTokens, type Token } from '../../../hooks/useTokenLists.js';
import { useCofheChainId } from '../../../hooks/useCofheConnection.js';
import { useMemo } from 'react';
import { TokenRow } from './TokenListPage/TokenRow.js';

export const TokenListPage: React.FC = () => {
  const { navigateBack, tokenListMode, showNativeTokenInList } = useFnxFloatingButtonContext();
  const chainId = useCofheChainId();
  const tokens = useTokens(chainId ?? 0);

  // Combine native token (if enabled) and confidential tokens
  const allTokens: Array<Token | NativeToken> = useMemo(() => {
    const result: Array<Token | NativeToken> = [];

    // Add native token first if enabled
    if (showNativeTokenInList) {
      result.push({
        address: 'native',
        name: 'Ether',
        symbol: 'ETH',
        decimals: 18,
        isNative: true,
      });
    }

    // Add all confidential tokens from the token list
    tokens.forEach((token: Token) => {
      result.push(token);
    });

    return result;
  }, [tokens, showNativeTokenInList]);

  const pageTitle = tokenListMode === 'select' ? 'Select token to transfer' : 'Token List';

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
