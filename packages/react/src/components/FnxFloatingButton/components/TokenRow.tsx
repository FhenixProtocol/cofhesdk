import KeyboardArrowRightIcon from '@mui/icons-material/KeyboardArrowRight';
import { cn } from '../../../utils/cn';
import type { Token } from '@/hooks/useCofheTokenLists';
import { TokenIcon } from './TokenIcon';
import { CofheTokenConfidentialBalance, BalanceType, CofheTokenPublicBalance } from './CofheTokenConfidentialBalance';
import { useCofheTokenDecryptedBalance, useCoingeckoUsdPrice } from '@/hooks';
import { sepolia } from '@cofhe/sdk/chains';
import { useCofheAccount } from '@/hooks/useCofheConnection';
import { formatUsdAmount } from '@/utils/format';
import { useCofheTokenPublicBalance } from '@/hooks/useCofheTokenPublicBalance';

const TMP_WBTC_ON_MAINNET = {
  chainId: 1,
  address: '0x2260fac5e5542a773aa44fbcfedf7c193bc2c599',
} as const;

export const TokenRow: React.FC<{
  token: Token;
  onClick: () => void;
  balanceType: BalanceType;
  topLabel?: string;
}> = ({ token, onClick, topLabel, balanceType }) => {
  const account = useCofheAccount();
  const { data: confidentialBalance } = useCofheTokenDecryptedBalance(
    {
      token,
      accountAddress: account,
    },
    {
      enabled: balanceType === BalanceType.Confidential,
    }
  );

  const { data: publicBalance } = useCofheTokenPublicBalance({ token, accountAddress: account });
  // tmp: TODO: for testnet, fetch the price of WBTC on mainnet to display in the UI
  const { data: price } = useCoingeckoUsdPrice(
    token.chainId === sepolia.id
      ? {
          chainId: TMP_WBTC_ON_MAINNET.chainId,
          tokenAddress: TMP_WBTC_ON_MAINNET.address,
        }
      : {
          chainId: token.chainId,
          tokenAddress: token.extensions.fhenix.erc20Pair?.address,
        }
  );

  const usdValue =
    balanceType === BalanceType.Confidential
      ? confidentialBalance && price && formatUsdAmount(confidentialBalance.unit.multipliedBy(price))
      : publicBalance && price && formatUsdAmount(publicBalance.unit.multipliedBy(price));

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
          <div className="text-sm font-medium fnx-text-primary truncate leading-tight">
            {balanceType === BalanceType.Confidential ? token.symbol : token.extensions.fhenix.erc20Pair?.symbol}
          </div>
        </div>
      </div>

      {/* Balance and Arrow */}
      <div className="flex items-center gap-2 flex-shrink-0">
        <div className="w-24 text-right whitespace-nowrap tabular-nums">
          {balanceType === BalanceType.Confidential ? (
            <CofheTokenConfidentialBalance
              token={token}
              showSymbol={false}
              size="sm"
              decimalPrecision={5}
              className="font-medium inline-block w-full text-right"
            />
          ) : (
            <CofheTokenPublicBalance
              token={token}
              showSymbol={false}
              size="sm"
              decimalPrecision={5}
              className="font-medium inline-block w-full text-right"
            />
          )}
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
