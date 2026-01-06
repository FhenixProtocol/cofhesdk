import KeyboardArrowRightIcon from '@mui/icons-material/KeyboardArrowRight';
import { cn } from '../../../../utils/cn.js';
import { useFnxFloatingButtonContext, type TokenListMode, type NativeToken } from '../../FnxFloatingButtonContext.js';
import type { Token } from '../../../../hooks/useCofheTokenLists.js';
import { TokenIcon } from '../../components/TokenIcon.js';
import { TokenBalance } from '../../components/TokenBalance.js';

export const TokenRow: React.FC<{
  token: Token;
  mode: TokenListMode;
}> = ({ token, mode }) => {
  const { selectToken, navigateToTokenInfo } = useFnxFloatingButtonContext();

  const handleClick = () => {
    if (mode === 'select') {
      // TODO: native token support
      selectToken({
        ...token,
        isNative: false,
      });
    } else {
      // In view mode, navigate to token info page
      navigateToTokenInfo({
        ...token,
        isNative: false,
      });
    }
  };

  return (
    <div
      onClick={handleClick}
      className={cn(
        'flex items-center justify-between p-1',
        'hover:bg-white hover:bg-opacity-5 transition-colors',
        'cursor-pointer'
      )}
    >
      <div className="flex items-center gap-3 flex-1 min-w-0">
        {/* Token Icon */}
        <TokenIcon logoURI={token.logoURI} alt={token.name} size="sm" />

        {/* Token Name and Symbol */}
        <div className="flex items-center gap-1 min-w-0 flex-1">
          <span className="text-sm font-medium fnx-text-primary truncate">{token.name}</span>
          <span className="text-xxxs opacity-70 fnx-text-primary">({token.symbol})</span>
        </div>
      </div>

      {/* Balance and Arrow */}
      <div className="flex items-center gap-2">
        <TokenBalance token={token} showSymbol={false} size="sm" decimalPrecision={5} className="font-medium" />
        <KeyboardArrowRightIcon className="w-5 h-5 fnx-text-primary opacity-60 flex-shrink-0" />
      </div>
    </div>
  );
};
