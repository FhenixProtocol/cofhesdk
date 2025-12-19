import { cn } from '@/utils/cn.js';
import KeyboardArrowRightIcon from '@mui/icons-material/KeyboardArrowRight';
import { useCofheTokenMetadata, useCofhePinnedTokenAddress } from '../../../../hooks/useCofheTokenBalance.js';
import { useCofheTokens } from '../../../../hooks/useCofheTokenLists.js';
import { useCofheChainId } from '../../../../hooks/useCofheConnection.js';
import { useMemo } from 'react';
import { TokenIcon } from '../../components/TokenIcon.js';
import { TokenBalance } from '../../components/TokenBalance.js';
import { useFnxFloatingButtonContext } from '../../FnxFloatingButtonContext.js';

export const AssetCard: React.FC = () => {
  const { navigateToTokenInfo } = useFnxFloatingButtonContext();
  // const pinnedTokenAddress = "0x8ee52408ED5b0e396aA779Fd52F7fbc20A4b33Fb"; // Base sepolia
  // const pinnedTokenAddress = "0xbED96aa98a49FeA71fcC55d755b915cF022a9159"; // Redact (Sepolia)
  const pinnedTokenAddress = useCofhePinnedTokenAddress();

  const chainId = useCofheChainId();
  const tokens = useCofheTokens(chainId);

  // Get token metadata (decimals and symbol) using multicall for efficiency
  const { data: tokenMetadata } = useCofheTokenMetadata(pinnedTokenAddress);
  const tokenSymbol = tokenMetadata?.symbol;

  // Find token from token lists to get icon and confidentialityType
  const tokenFromList = useMemo(() => {
    if (!pinnedTokenAddress || !chainId) return null;
    return (
      tokens.find((t) => t.chainId === chainId && t.address.toLowerCase() === pinnedTokenAddress.toLowerCase()) || null
    );
  }, [pinnedTokenAddress, chainId, tokens]);

  // Determine ticker symbol
  const ticker = useMemo(() => {
    if (pinnedTokenAddress && tokenSymbol) {
      return tokenSymbol;
    }
    // For native token, default to ETH (most chains use ETH or ETH-like tokens)
    return 'ETH';
  }, [pinnedTokenAddress, tokenSymbol]);

  const handleClick = () => {
    navigateToTokenInfo({
      address: pinnedTokenAddress ?? 'native',
      name: tokenFromList?.name ?? ticker,
      symbol: ticker,
      decimals: tokenMetadata?.decimals ?? 18,
      logoURI: tokenFromList?.logoURI,
      isNative: !pinnedTokenAddress,
    });
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
            <h3 className="text-lg font-bold fnx-text-primary">{ticker}</h3>

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
              token={tokenFromList ?? undefined}
              tokenAddress={pinnedTokenAddress ?? undefined}
              isNative={!pinnedTokenAddress}
              symbol={ticker}
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
