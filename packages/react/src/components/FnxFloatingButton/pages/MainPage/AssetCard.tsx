import { cn } from '../../../../utils/cn.js';
import KeyboardArrowRightIcon from '@mui/icons-material/KeyboardArrowRight';
import VisibilityOffIcon from '@mui/icons-material/VisibilityOff';
import VisibilityIcon from '@mui/icons-material/Visibility';
import { useTokenConfidentialBalance, useTokenMetadata, useNativeBalance, usePinnedTokenAddress } from '../../../../hooks/useTokenBalance.js';
import { useTokens } from '../../../../hooks/useTokenLists.js';
import { useCofheChainId } from '../../../../hooks/useCofheConnection.js';
import { useMemo, useState, useEffect } from 'react';

export const AssetCard: React.FC = () => {
  // const pinnedTokenAddress = "0x8ee52408ED5b0e396aA779Fd52F7fbc20A4b33Fb"; // Base sepolia
  // const pinnedTokenAddress = "0xbED96aa98a49FeA71fcC55d755b915cF022a9159"; // Redact (Sepolia)
  const pinnedTokenAddress = usePinnedTokenAddress();
  
  const chainId = useCofheChainId();
  const tokens = useTokens(chainId ?? 0);
  
  // Get token metadata (decimals and symbol) using multicall for efficiency
  const { data: tokenMetadata } = useTokenMetadata(pinnedTokenAddress);
  const tokenDecimals = tokenMetadata?.decimals;
  const tokenSymbol = tokenMetadata?.symbol;
  
  // Find token icon from token lists if available
  const tokenIcon = useMemo(() => {
    if (!pinnedTokenAddress || !chainId) return undefined;
    const token = tokens.find(
      (t) => t.chainId === chainId && t.address.toLowerCase() === pinnedTokenAddress.toLowerCase()
    );
    return token?.logoURI;
  }, [pinnedTokenAddress, chainId, tokens]);
  
  const [iconError, setIconError] = useState(false);
  
  // Reset icon error when token icon changes
  useEffect(() => {
    setIconError(false);
  }, [tokenIcon]);
  
  // Get confidential token balance if pinned token exists, otherwise get native balance
  const { data: confidentialBalance } = useTokenConfidentialBalance(
    {
      tokenAddress: pinnedTokenAddress!,
    }
  );
  
  const { data: nativeBalance } = useNativeBalance();

  // Determine which balance to show
  const displayBalance = useMemo(() => {
    if (pinnedTokenAddress && confidentialBalance !== undefined && tokenDecimals) {
      // Normalize confidential balance by decimals and format for display
      const divisor = BigInt(10 ** tokenDecimals);
      const normalizedValue = Number(confidentialBalance) / Number(divisor);
      return normalizedValue.toFixed(5).replace(/\.?0+$/, '');
    }
    if (!pinnedTokenAddress && nativeBalance) {
      return nativeBalance;
    }
    return '0.00';
  }, [pinnedTokenAddress, confidentialBalance, tokenDecimals, nativeBalance]);

  // Determine ticker symbol
  const ticker = useMemo(() => {
    if (pinnedTokenAddress && tokenSymbol) {
      return tokenSymbol;
    }
    // For native token, default to ETH (most chains use ETH or ETH-like tokens)
    return 'ETH';
  }, [pinnedTokenAddress, tokenSymbol]);

  // Mock data for privacy metrics and change - replace with actual data when available
  const asset = {
    ticker,
    balance: displayBalance,
    change: '+1.32%',
    privacyHidden: 65,
    privacyVisible: 35,
  };

  return (
    <div
      className={cn(
        'fnx-card-bg rounded-lg p-4 mb-4 cursor-pointer',
        'hover:opacity-90 transition-opacity',
        'border fnx-card-border'
      )}
    >
      <div className="flex items-start justify-between">
        {/* Left Side: Icon, Ticker, Privacy Metrics */}
        <div className="flex items-start gap-3 flex-1">
          {/* Asset Icon */}
          <div className="w-12 h-12 rounded-full fnx-icon-bg flex items-center justify-center flex-shrink-0 overflow-hidden">
            {tokenIcon && !iconError ? (
              <img 
                src={tokenIcon} 
                alt={tokenSymbol || 'Token'} 
                className="w-full h-full object-cover"
                onError={() => setIconError(true)}
              />
            ) : (
              <span className="text-xl">⟠</span>
            )}
          </div>

          {/* Ticker and Privacy */}
          <div className="flex flex-col gap-1">
            <h3 className="text-lg font-bold fnx-text-primary">{asset.ticker}</h3>
            
            {/* Privacy Metrics */}
            <div className="flex items-center gap-2 text-xs fnx-text-primary opacity-80">
              <div className="flex items-center gap-1">
                <VisibilityOffIcon className="w-3 h-3" />
                <span>{asset.privacyHidden}%</span>
              </div>
              <span>|</span>
              <div className="flex items-center gap-1">
                <VisibilityIcon className="w-3 h-3" />
                <span>{asset.privacyVisible}%</span>
              </div>
            </div>
          </div>
        </div>

        {/* Right Side: Balance, Change, Arrow */}
        <div className="flex items-center gap-2">
          <div className="flex flex-col items-end">
            <div className="text-2xl font-bold fnx-text-primary">
              {asset.balance}
            </div>
            <div className="text-sm fnx-positive-change font-medium">
              {asset.change}
            </div>
          </div>
          <KeyboardArrowRightIcon className="w-5 h-5 fnx-text-primary opacity-60" />
        </div>
      </div>
    </div>
  );
};

