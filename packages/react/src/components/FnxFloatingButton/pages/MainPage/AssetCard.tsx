import { cn } from '@/utils/cn';
import KeyboardArrowRightIcon from '@mui/icons-material/KeyboardArrowRight';
import { useCofheTokenMetadata, useCofhePinnedTokenAddress } from '../../../../hooks/useCofheTokenBalance';
import { useCofheToken } from '../../../../hooks/useCofheTokenLists';
import { useMemo } from 'react';
import { TokenIcon } from '../../components/TokenIcon';
import { TokenBalance } from '../../components/TokenBalance';
import { useFnxFloatingButtonContext } from '../../FnxFloatingButtonContext';

export const AssetCard: React.FC = () => {
  // TODO: show Native token if no pinned token address

  const { navigateToTokenInfo } = useFnxFloatingButtonContext();
  // const pinnedTokenAddress = "0x8ee52408ED5b0e396aA779Fd52F7fbc20A4b33Fb"; // Base sepolia
  // const pinnedTokenAddress = "0xbED96aa98a49FeA71fcC55d755b915cF022a9159"; // Redact (Sepolia)
  const pinnedTokenAddress = useCofhePinnedTokenAddress();

  // Get token metadata (decimals and symbol) using multicall for efficiency
  const { data: tokenMetadata } = useCofheTokenMetadata(pinnedTokenAddress);
  const tokenSymbol = tokenMetadata?.symbol;

  // Find token from token lists to get icon and confidentialityType
  const tokenFromList = useCofheToken({
    address: pinnedTokenAddress,
  });

  const handleClick = () => {
    // TODO: figure out best handling for this error
    if (!tokenFromList) throw new Error('Token not found in token list');

    if (pinnedTokenAddress) {
      navigateToTokenInfo(tokenFromList);
    } else {
      // TODO: native token support
      alert('Native token info navigation is not implemented yet.');
    }
  };

  return (
    <div
      onClick={handleClick}
      className={cn(
        'fnx-card-bg p-4 mb-4 cursor-pointer',
        'hover:opacity-90 transition-opacity',
        'border fnx-card-border'
      )}
    >
      <div className="flex items-center justify-between">
        {/* Left Side: Icon, Ticker, Privacy Metrics */}
        <div className="flex items-center gap-3 flex-1">
          {/* Asset Icon */}
          <TokenIcon logoURI={tokenFromList?.logoURI} alt={tokenSymbol || 'Token'} size="md" />

          {/* Ticker and Privacy */}
          <div className="flex flex-col gap-1">
            <h3 className="text-lg font-bold fnx-text-primary">{tokenFromList?.symbol}</h3>

            {/* Privacy Metrics Placeholder for future implementation */}
            {/* <div className="flex items-center gap-2 text-xs fnx-text-primary opacity-80">
              <div className="flex items-center gap-1">
                <VisibilityOffIcon className="w-3 h-3" />
                <span>{asset.privacyHidden}%</span>
              </div>
              <span>|</span>
              <div className="flex items-center gap-1">
                <VisibilityIcon className="w-3 h-3" />
                <span>{asset.privacyVisible}%</span>
              </div>
            </div> */}
          </div>
        </div>

        {/* Right Side: Balance, Change, Arrow */}
        <div className="flex items-center gap-2">
          <div className="flex flex-col items-end">
            <TokenBalance
              token={tokenFromList}
              isNative={!pinnedTokenAddress}
              showSymbol={false}
              size="xl"
              decimalPrecision={5}
              className="font-bold"
            />
            {/* <div className="text-sm fnx-positive-change font-medium">
              {asset.change}
            </div> */}
          </div>
          <KeyboardArrowRightIcon className="w-5 h-5 fnx-text-primary opacity-60" />
        </div>
      </div>
    </div>
  );
};
