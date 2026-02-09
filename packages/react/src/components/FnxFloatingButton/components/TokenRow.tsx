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
  topLabel?: string;
}> = ({ token, onClick, topLabel }) => {
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
        'flex items-center justify-between px-3 py-2 rounded-lg',
        'fnx-hover-overlay transition-colors',
        'cursor-pointer'
      )}
    >
      <div className="flex items-center gap-3 flex-1 min-w-0">
        {/* Token Icon */}
        <TokenIcon logoURI={token.logoURI} alt={token.name} size="sm" />

        {/* Token label */}
        <div className="min-w-0 flex-1">
          {topLabel && <div className="text-xxxs opacity-70 fnx-text-primary leading-none">{topLabel}</div>}
          <div className="text-sm font-medium fnx-text-primary truncate leading-tight">{token.symbol}</div>
        </div>
      </div>

      {/* Balance and Arrow */}
      <div className="flex items-center gap-2 flex-shrink-0">
        <div className="w-24 text-right whitespace-nowrap tabular-nums">
          <CofheTokenConfidentialBalance
            token={token}
            showSymbol={false}
            size="sm"
            decimalPrecision={5}
            className="font-medium inline-block w-full text-right"
          />
        </div>

        <div className="w-24 text-right whitespace-nowrap tabular-nums">
          {usdValue ? (
            <span className="text-sm opacity-70 fnx-text-primary inline-block w-full text-right">{usdValue}</span>
          ) : (
            <span className="text-sm opacity-0 select-none inline-block w-full text-right">$0.00</span>
          )}
        </div>

        <KeyboardArrowRightIcon className="w-5 h-5 fnx-text-primary opacity-60 flex-shrink-0" />
      </div>
    </div>
  );
};
