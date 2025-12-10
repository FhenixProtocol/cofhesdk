import { useMemo } from 'react';
import { formatUnits } from 'viem';
import type { Address } from 'viem';
import { useTokenConfidentialBalance, useNativeBalance } from '../../../hooks/useTokenBalance.js';
import { useCofheAccount } from '../../../hooks/useCofheConnection.js';
import { useTokens, type Token } from '../../../hooks/useTokenLists.js';
import { useCofheChainId } from '../../../hooks/useCofheConnection.js';
import { cn } from '../../../utils/cn.js';
import { LoadingDots } from './LoadingDots.js';

export interface TokenBalanceProps {
  /** Token object from token list (for non-native tokens) */
  token?: Token | null;
  /** Token address (for non-native tokens) */
  tokenAddress?: string | null;
  /** Whether this is a native token */
  isNative?: boolean;
  /** Account address to fetch balance for */
  accountAddress?: Address | null;
  /** Number of decimal places to show (default: 5) */
  decimalPrecision?: number;
  /** Whether to show the token symbol */
  showSymbol?: boolean;
  /** Token symbol to display (if not provided, will try to get from token) */
  symbol?: string;
  /** Custom className for the balance text */
  className?: string;
  /** Size variant for the balance display */
  size?: 'sm' | 'md' | 'lg' | 'xl';
  /** Whether to show "0.00" when balance is loading/undefined */
  showZeroWhenLoading?: boolean;
}

const sizeClasses = {
  sm: 'text-sm',
  md: 'text-base',
  lg: 'text-xl',
  xl: 'text-2xl',
};

export const TokenBalance: React.FC<TokenBalanceProps> = ({
  token,
  tokenAddress,
  isNative = false,
  accountAddress,
  decimalPrecision = 5,
  showSymbol = false,
  symbol,
  className,
  size = 'md',
  showZeroWhenLoading = true,
}) => {
  const account = useCofheAccount();
  const chainId = useCofheChainId();
  const tokens = useTokens(chainId ?? 0);

  // Determine which account address to use
  const effectiveAccountAddress = accountAddress ?? account;

  // Find token from list if tokenAddress is provided but token is not
  const tokenFromList = useMemo(() => {
    if (token) return token;
    if (!tokenAddress || !chainId || isNative) return null;
    return tokens.find((t) => t.chainId === chainId && t.address.toLowerCase() === tokenAddress.toLowerCase()) || null;
  }, [token, tokenAddress, chainId, tokens, isNative]);

  // Get confidential balance for non-native tokens
  const { data: confidentialBalance, isLoading: isLoadingConfidential } = useTokenConfidentialBalance(
    {
      token: tokenFromList ?? undefined,
      accountAddress: effectiveAccountAddress as Address,
    },
    {
      enabled: !isNative && !!tokenFromList && !!effectiveAccountAddress,
    }
  );

  // Get native balance for native tokens
  const { data: nativeBalance, isLoading: isLoadingNative } = useNativeBalance();

  // Determine token decimals
  const decimals = useMemo(() => {
    if (tokenFromList) return tokenFromList.decimals;
    if (token) return token.decimals;
    // Default to 18 for native tokens if not specified
    return isNative ? 18 : undefined;
  }, [tokenFromList, token, isNative]);

  // Determine token symbol
  const displaySymbol = useMemo(() => {
    if (symbol) return symbol;
    if (tokenFromList) return tokenFromList.symbol;
    if (token) return token.symbol;
    if (isNative) return 'ETH';
    return '';
  }, [symbol, tokenFromList, token, isNative]);

  // Determine if we're loading
  const isLoading = isNative ? isLoadingNative : isLoadingConfidential;

  // Format balance
  const displayBalance = useMemo(() => {
    if (isNative) {
      return nativeBalance || (showZeroWhenLoading ? '0.00' : '');
    }

    if (confidentialBalance !== undefined && decimals !== undefined) {
      const formatted = formatUnits(confidentialBalance, decimals);
      // Format to specified decimal precision
      const numValue = parseFloat(formatted);
      if (isNaN(numValue)) return showZeroWhenLoading ? '0.00' : '';
      return numValue.toFixed(decimalPrecision);
    }

    return showZeroWhenLoading ? '0.00' : '';
  }, [isNative, nativeBalance, confidentialBalance, decimals, decimalPrecision, showZeroWhenLoading]);

  // Show loading animation when loading
  if (isLoading && showZeroWhenLoading) {
    return (
      <span className={cn(sizeClasses[size], 'font-medium fnx-text-primary', className)}>
        <LoadingDots size={size} />
        {showSymbol && displaySymbol && ` ${displaySymbol}`}
      </span>
    );
  }

  if (!displayBalance && !showZeroWhenLoading) {
    return null;
  }

  return (
    <span className={cn(sizeClasses[size], 'font-medium fnx-text-primary', className)}>
      {displayBalance}
      {showSymbol && displaySymbol && ` ${displaySymbol}`}
    </span>
  );
};
