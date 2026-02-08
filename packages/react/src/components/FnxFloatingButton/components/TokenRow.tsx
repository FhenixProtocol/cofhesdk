import KeyboardArrowRightIcon from '@mui/icons-material/KeyboardArrowRight';
import { cn } from '../../../utils/cn';
import type { Token } from '@/hooks/useCofheTokenLists';
import { TokenIcon } from './TokenIcon';
import { CofheTokenConfidentialBalance } from '.';
import { useCoingeckoUsdPrice } from '@/hooks';

export const TokenRow: React.FC<{
  token: Token;
  onClick: () => void;
}> = ({ token, onClick }) => {
  const price = useCoingeckoUsdPrice({
    chainId: token.chainId,
    tokenAddress: token.address,
  });
  console.log('price', price);
  return (
    <div
      onClick={onClick}
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
        <CofheTokenConfidentialBalance
          token={token}
          showSymbol={false}
          size="sm"
          decimalPrecision={5}
          className="font-medium"
        />
        <KeyboardArrowRightIcon className="w-5 h-5 fnx-text-primary opacity-60 flex-shrink-0" />
      </div>
    </div>
  );
};
