import { cn } from '@/utils/cn';
import KeyboardArrowRightIcon from '@mui/icons-material/esm/KeyboardArrowRight';
import { TokenIcon } from '../../components/TokenIcon';
import { CofheTokenConfidentialBalance } from '../../components/CofheTokenConfidentialBalance';
import { FloatingButtonPage } from '../../pagesConfig/types';
import { usePortalNavigation } from '@/stores';
import { useCofhePinnedToken } from '@/hooks/useCofhePinnedToken';
import { useCofheChainId } from '@/hooks/useCofheConnection';
import { DEFAULT_TOKEN_BY_CHAIN_ID } from '@/types/token';

export const AssetCard: React.FC = () => {
  const { navigateTo } = usePortalNavigation();

  const pinnedToken = useCofhePinnedToken();
  const chainId = useCofheChainId();
  const fallbackToken = chainId ? DEFAULT_TOKEN_BY_CHAIN_ID[chainId] : undefined;
  const token = pinnedToken ?? fallbackToken;

  const handleClick = () => {
    if (token) {
      navigateTo(FloatingButtonPage.TokenInfo, {
        pageProps: { token },
      });
    } else {
      throw new Error('No token found for AssetCard. No pinned token and no fallback token for current chain.');
    }
  };

  return (
    <div
      onClick={handleClick}
      className={cn('fnx-card-bg p-4 cursor-pointer', 'hover:opacity-90 transition-opacity', 'border fnx-card-border')}
    >
      <div className="flex items-center justify-between">
        {/* Left Side: Icon, Ticker, Privacy Metrics */}
        <div className="flex items-center gap-3 flex-1">
          {/* Asset Icon */}
          <TokenIcon logoURI={token?.logoURI} alt={token?.symbol} size="md" />

          {/* Ticker and Privacy */}
          <div className="flex flex-col gap-1">
            <h3 className="text-lg font-bold fnx-text-primary">{token?.symbol}</h3>
          </div>
        </div>

        {/* Right Side: Balance, Change, Arrow */}
        <div className="flex items-center gap-2">
          <div className="flex flex-col items-end">
            <CofheTokenConfidentialBalance
              token={token}
              showSymbol={false}
              size="xl"
              decimalPrecision={5}
              className="font-bold"
            />
          </div>
          <KeyboardArrowRightIcon className="w-5 h-5 fnx-text-primary opacity-60" />
        </div>
      </div>
    </div>
  );
};
