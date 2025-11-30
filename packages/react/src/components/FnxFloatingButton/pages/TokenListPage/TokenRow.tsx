import KeyboardArrowRightIcon from '@mui/icons-material/KeyboardArrowRight';
import { useTokenConfidentialBalance } from '../../../../hooks/useTokenBalance.js';
import { useCofheAccount } from '../../../../hooks/useCofheConnection.js';
import { useMemo, useState, useEffect } from 'react';
import { cn } from '../../../../utils/cn.js';
import { formatUnits } from 'viem';
import type { Address } from 'viem';
import { useFnxFloatingButtonContext, type TokenListMode } from '../../FnxFloatingButtonContext.js';

type TokenWithBalance = {
  address: string;
  name: string;
  symbol: string;
  decimals: number;
  logoURI?: string;
  balance: string;
  isNative: boolean;
};

export const TokenRow: React.FC<{ token: TokenWithBalance; mode: TokenListMode }> = ({ token, mode }) => {
  const account = useCofheAccount();
  const { selectToken } = useFnxFloatingButtonContext();
  const [iconError, setIconError] = useState(false);

  // Get confidential token balance if it's not native
  const { data: confidentialBalance } = useTokenConfidentialBalance(
    {
      tokenAddress: token.address as Address,
      accountAddress: account as Address | undefined,
    }
  );

  useEffect(() => {
    setIconError(false);
  }, [token.logoURI]);

  // Determine display balance
  const displayBalance = useMemo(() => {
    if (token.isNative) {
      return token.balance;
    }
    
    if (confidentialBalance !== undefined && token.decimals) {
      return formatUnits(confidentialBalance, token.decimals);
    }
    
    return '0';
  }, [token.isNative, token.balance, token.decimals, confidentialBalance]);

  const handleClick = () => {
    if (mode === 'select') {
      selectToken({
        address: token.address,
        name: token.name,
        symbol: token.symbol,
        decimals: token.decimals,
        logoURI: token.logoURI,
        isNative: token.isNative,
      });
    }
  };

  return (
    <div
      onClick={handleClick}
      className={cn(
        'flex items-center justify-between p-1',
        'hover:bg-white hover:bg-opacity-5 transition-colors',
        mode === 'select' ? 'cursor-pointer' : 'cursor-default',
      )}
    >
      <div className="flex items-center gap-3 flex-1 min-w-0">
        {/* Token Icon */}
        <div className="w-5 h-5 rounded-full fnx-icon-bg flex items-center justify-center flex-shrink-0 overflow-hidden">
          {token.logoURI && !iconError ? (
            <img
              src={token.logoURI}
              alt={token.name}
              className="w-full h-full object-cover"
              onError={() => setIconError(true)}
            />
          ) : (
            <span className="text-lg">⟠</span>
          )}
        </div>

        {/* Token Name and Symbol */}
        <div className="flex items-center gap-1 min-w-0 flex-1">
          <span className="text-sm font-medium fnx-text-primary truncate">{token.name}</span>
          <span className="text-xxxs opacity-70 fnx-text-primary">({token.symbol})</span>
        </div>
      </div>

      {/* Balance and Arrow */}
      <div className="flex items-center gap-2">
        <div className="flex items-center gap-1">
          <span className="text-sm font-medium fnx-text-primary">{displayBalance}</span>
        </div>
        <KeyboardArrowRightIcon className="w-5 h-5 fnx-text-primary opacity-60 flex-shrink-0" />
      </div>
    </div>
  );
};

