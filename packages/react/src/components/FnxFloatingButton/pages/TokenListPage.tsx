import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import { useFnxFloatingButtonContext } from '../FnxFloatingButtonContext.js';
import { useTokens, type Token } from '../../../hooks/useTokenLists.js';
import { useCofheChainId } from '../../../hooks/useCofheConnection.js';
import { useNativeBalance } from '../../../hooks/useTokenBalance.js';
import { useMemo } from 'react';
import { TokenRow } from './TokenListPage/TokenRow.js';

type TokenWithBalance = {
  address: string;
  name: string;
  symbol: string;
  decimals: number;
  logoURI?: string;
  balance: string;
  isNative: boolean;
};

export const TokenListPage: React.FC = () => {
  const { navigateBack, tokenListMode } = useFnxFloatingButtonContext();
  const chainId = useCofheChainId();
  const tokens = useTokens(chainId ?? 0);

  // Get native balance
  const { data: nativeBalance } = useNativeBalance();

  // Combine native token and ERC20 tokens
  const tokensWithBalances: TokenWithBalance[] = useMemo(() => {
    const result: TokenWithBalance[] = [];

    // Add native token first
    result.push({
      address: 'native',
      name: 'Ether',
      symbol: 'ETH',
      decimals: 18,
      balance: nativeBalance || '0',
      isNative: true,
    });

    // Add all ERC20 tokens (they will fetch their own balances in TokenRow)
    tokens.forEach((token: Token) => {
      result.push({
        address: token.address,
        name: token.name,
        symbol: token.symbol,
        decimals: token.decimals,
        logoURI: token.logoURI,
        balance: '0', // Will be fetched by TokenRow
        isNative: false,
      });
    });

    return result;
  }, [nativeBalance, tokens]);

  const pageTitle = tokenListMode === 'select' ? 'Select token to transfer' : 'Token List';

  return (
    <div className="fnx-text-primary space-y-3">
      <button
        onClick={navigateBack}
        className="flex items-center gap-1 text-sm hover:opacity-80 transition-opacity"
      >
        <ArrowBackIcon style={{ fontSize: 16 }} />
        <span>Back</span>
      </button>
      <p className="text-sm font-medium">{pageTitle}</p>
      
      <div className="fnx-token-list-container">
        {tokensWithBalances.length === 0 ? (
          <p className="text-xs opacity-70 py-4 text-center">No tokens found</p>
        ) : (
          tokensWithBalances.map((token) => (
            <TokenRow key={token.address} token={token} mode={tokenListMode} />
          ))
        )}
      </div>
    </div>
  );
};

