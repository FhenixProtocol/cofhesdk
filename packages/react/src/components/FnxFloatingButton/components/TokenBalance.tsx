import { useMemo } from 'react';
import { formatUnits } from 'viem';
import type { Address } from 'viem';
import { useTokenConfidentialBalance, useNativeBalance } from '../../../hooks/useTokenBalance.js';
import { useCofheAccount } from '../../../hooks/useCofheConnection.js';
import { useTokens, type Token } from '../../../hooks/useTokenLists.js';
import { useCofheChainId } from '../../../hooks/useCofheConnection.js';
import { cn } from '../../../utils/cn.js';
import { LoadingDots } from './LoadingDots.js';
import { useFnxFloatingButtonContext } from '../FnxFloatingButtonContext';
import { FloatingButtonPage } from '../pagesConfig/types.js';
import { CREATE_PERMITT_BODY_BY_ERROR_CAUSE } from '@/providers/errors.js';
import { ErrorCause } from '@/utils/errors.js';

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
}) => {
  const account = useCofheAccount();
  const chainId = useCofheChainId();
  const tokens = useTokens(chainId);
  const { navigateTo, navigateBack } = useFnxFloatingButtonContext();

  // Determine which account address to use
  const effectiveAccountAddress = accountAddress ?? account;

  // Find token from list if tokenAddress is provided but token is not
  const tokenFromList = useMemo(() => {
    if (token) return token;
    if (!tokenAddress || !chainId || isNative) return null;
    return tokens.find((t) => t.chainId === chainId && t.address.toLowerCase() === tokenAddress.toLowerCase()) || null;
  }, [token, tokenAddress, chainId, tokens, isNative]);

  // Get confidential balance for non-native tokens
  const {
    data: confidentialBalance,
    isLoading: isLoadingConfidential,
    hasActivePermit,
  } = useTokenConfidentialBalance(
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

  const CONFIDENTIAL_VALUE_PLACEHOLDER = useMemo(
    () => (
      <div
        onClick={(e) => {
          e.stopPropagation();
          const ReasonBody = CREATE_PERMITT_BODY_BY_ERROR_CAUSE[ErrorCause.AttemptToFetchConfidentialBalance];
          navigateTo(FloatingButtonPage.GeneratePermits, {
            pageProps: { overridingBody: <ReasonBody />, onSuccessNavigateTo: () => navigateBack() },
            navigateParams: { skipPagesHistory: true },
          });
        }}
      >
        {'* * *'}
      </div>
    ),
    [navigateBack, navigateTo]
  );
  // Format balance
  const displayBalance = useMemo(() => {
    if (!hasActivePermit) return CONFIDENTIAL_VALUE_PLACEHOLDER;

    if (isNative) return nativeBalance;

    if (confidentialBalance !== undefined && decimals !== undefined) {
      const formatted = formatUnits(confidentialBalance, decimals);
      // Format to specified decimal precision
      const numValue = parseFloat(formatted);
      if (isNaN(numValue)) return null;
      return numValue.toFixed(decimalPrecision);
    }

    return null;
  }, [
    isNative,
    nativeBalance,
    confidentialBalance,
    decimals,
    decimalPrecision,
    CONFIDENTIAL_VALUE_PLACEHOLDER,
    hasActivePermit,
  ]);

  // Show loading animation when loading
  if (isLoading) {
    return (
      <span className={cn(sizeClasses[size], 'font-medium fnx-text-primary', className)}>
        <LoadingDots size={size} />
        {showSymbol && displaySymbol && ` ${displaySymbol}`}
      </span>
    );
  }

  if (!displayBalance) {
    // ?
    return null;
  }

  return (
    <span className={cn(sizeClasses[size], 'font-medium fnx-text-primary', className)}>
      {displayBalance}
      {showSymbol && displaySymbol && ` ${displaySymbol}`}
    </span>
  );
};
