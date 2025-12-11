import { useMemo } from 'react';
import type { Address } from 'viem';
import { useCofhePublicTokenBalance, useCofheConfidentialTokenBalance, useCofheNativeBalance } from '../../../hooks/useCofheTokenBalance.js';
import { useCofheAccount } from '../../../hooks/useCofheConnection.js';
import { useCofheTokens, type Token } from '../../../hooks/useCofheTokenLists.js';
import { useCofheChainId } from '../../../hooks/useCofheConnection.js';
import { cn } from '../../../utils/cn.js';
import { LoadingDots } from './LoadingDots.js';

export enum BalanceType {
  Public = 'public',
  Confidential = 'confidential',
}

export interface TokenBalanceProps {
  /** Token object from token list (for non-native tokens) */
  token?: Token | null;
  /** Token address (for non-native tokens) */
  tokenAddress?: string | null;
  /** Whether this is a native token */
  isNative?: boolean;
  /** Account address to fetch balance for */
  accountAddress?: Address | null;
  /** Type of balance to display: 'public' (ERC20 balanceOf) or 'confidential' (encrypted) */
  balanceType?: BalanceType;
  /** Pre-fetched balance value (skips fetching if provided) */
  value?: string | number | null;
  /** Whether the value is loading (only used with value prop) */
  isLoading?: boolean;
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
  balanceType = BalanceType.Confidential,
  value,
  isLoading: isLoadingProp,
  decimalPrecision = 5,
  showSymbol = false,
  symbol,
  className,
  size = 'md',
  showZeroWhenLoading = true,
}) => {
  const account = useCofheAccount();
  const chainId = useCofheChainId();
  const tokens = useCofheTokens(chainId ?? 0);

  // If value is provided, use it directly (skip fetching)
  const useProvidedValue = value !== undefined;

  // Determine which account address to use
  const effectiveAccountAddress = (accountAddress ?? account) as Address | undefined;

  // Find token from list if tokenAddress is provided but token is not
  const tokenFromList = useMemo(() => {
    if (token) return token;
    if (!tokenAddress || !chainId || isNative) return null;
    return tokens.find((t) => t.chainId === chainId && t.address.toLowerCase() === tokenAddress.toLowerCase()) || null;
  }, [token, tokenAddress, chainId, tokens, isNative]);

  // Use unified hooks for balance fetching
  const {
    numericValue: publicBalanceNum,
    isLoading: isLoadingPublic,
  } = useCofhePublicTokenBalance(
    { token: tokenFromList, accountAddress: effectiveAccountAddress, displayDecimals: decimalPrecision },
    { enabled: !useProvidedValue && !isNative && balanceType === BalanceType.Public && !!tokenFromList && !!effectiveAccountAddress }
  );

  const {
    numericValue: confidentialBalanceNum,
    isLoading: isLoadingConfidential,
  } = useCofheConfidentialTokenBalance(
    { token: tokenFromList, accountAddress: effectiveAccountAddress, displayDecimals: decimalPrecision },
    { enabled: !useProvidedValue && !isNative && balanceType === BalanceType.Confidential && !!tokenFromList && !!effectiveAccountAddress }
  );

  // Get native balance for native tokens
  const { data: nativeBalance, isLoading: isLoadingNative } = useCofheNativeBalance(
    effectiveAccountAddress,
    18,
    decimalPrecision,
    { enabled: !useProvidedValue && isNative && !!effectiveAccountAddress }
  );

  // Determine token symbol
  const displaySymbol = useMemo(() => {
    if (symbol) return symbol;
    // For public balance of wrapped tokens, show the erc20Pair symbol
    const erc20Pair = tokenFromList?.extensions.fhenix.erc20Pair;
    const isWrappedToken = tokenFromList?.extensions.fhenix.confidentialityType === 'wrapped';
    if (balanceType === BalanceType.Public && isWrappedToken && erc20Pair?.symbol) {
      return erc20Pair.symbol;
    }
    if (tokenFromList) return tokenFromList.symbol;
    if (token) return token.symbol;
    if (isNative) return 'ETH';
    return '';
  }, [symbol, balanceType, tokenFromList, token, isNative]);

  // Determine if we're loading
  const isLoading = useMemo(() => {
    if (useProvidedValue) return isLoadingProp ?? false;
    if (isNative) return isLoadingNative;
    return balanceType === BalanceType.Public ? isLoadingPublic : isLoadingConfidential;
  }, [useProvidedValue, isLoadingProp, isNative, balanceType, isLoadingNative, isLoadingPublic, isLoadingConfidential]);

  // Format balance
  const displayBalance = useMemo(() => {
    // If value is provided, format it
    if (useProvidedValue) {
      if (value === null || value === undefined) {
        return showZeroWhenLoading ? '0.00' : '';
      }
      const numValue = typeof value === 'string' ? parseFloat(value) : value;
      if (isNaN(numValue)) return showZeroWhenLoading ? '0.00' : '';
      return numValue.toFixed(decimalPrecision);
    }

    // Native token balance
    if (isNative) {
      return nativeBalance || (showZeroWhenLoading ? '0.00' : '');
    }

    // Public or confidential balance from hooks
    const numValue = balanceType === BalanceType.Public ? publicBalanceNum : confidentialBalanceNum;
    if (numValue === 0 && !showZeroWhenLoading) return '';
    return numValue.toFixed(decimalPrecision);
  }, [useProvidedValue, value, isNative, balanceType, nativeBalance, publicBalanceNum, confidentialBalanceNum, decimalPrecision, showZeroWhenLoading]);

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
