import KeyboardArrowRightIcon from '@mui/icons-material/KeyboardArrowRight';
import { cn } from '../../../utils/cn';
import type { Token } from '@/hooks/useCofheTokenLists';
import { TokenIcon } from './TokenIcon';
import { CofheTokenConfidentialBalance } from '.';
import { useCofheTokenDecryptedBalance, useCoingeckoUsdPrice } from '@/hooks';
import { sepolia } from '@cofhe/sdk/chains';
import { useCofheAccount } from '@/hooks/useCofheConnection';
import { formatUsdAmount } from '@/utils/format';

const TMP_WBTC_ON_MAINNET = {
  chainId: 1,
  address: '0x2260fac5e5542a773aa44fbcfedf7c193bc2c599',
} as const;

export const TokenRow: React.FC<{
  token: Token;
  onClick: () => void;
}> = ({ token, onClick }) => {
  const account = useCofheAccount();
  const { data } = useCofheTokenDecryptedBalance({
    token,
    accountAddress: account,
  });
  // tmp: TODO: for testnet, fetch the price of WBTC on mainnet to display in the UI
  const { data: price } = useCoingeckoUsdPrice(
    token.chainId === sepolia.id
      ? {
          chainId: TMP_WBTC_ON_MAINNET.chainId,
          tokenAddress: TMP_WBTC_ON_MAINNET.address,
        }
      : {
          chainId: token.chainId,
          tokenAddress: token.address,
        }
  );

  const usdValue = data && price ? formatUsdAmount(data.unit.multipliedBy(price)) : null;

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
        {usdValue && <span className="text-xs opacity-70 fnx-text-primary">{usdValue}</span>}
        <KeyboardArrowRightIcon className="w-5 h-5 fnx-text-primary opacity-60 flex-shrink-0" />
      </div>
    </div>
  );
};
