import { useMemo } from 'react';
import type { Address } from 'viem';
import { useCofhePublicTokenBalance, useCofheTokenDecryptedBalance } from '../../../hooks/useCofheTokenBalance';
import { useCofheAccount } from '../../../hooks/useCofheConnection';
import { type Token } from '../../../hooks/useCofheTokenLists';
import { cn } from '../../../utils/cn';
import { LoadingDots } from './LoadingDots';
import { CREATE_PERMITT_BODY_BY_ERROR_CAUSE } from '@/providers/errors';
import { ErrorCause } from '@/utils/errors';
import { useCofheCreatePermit } from '@/hooks/permits/useCofheCreatePermit';

export enum BalanceType {
  Public = 'public',
  Confidential = 'confidential',
}

export interface TokenBalanceProps {
  /** Token object from token list (for non-native tokens) */
  token?: Token;
  /** Account address to fetch balance for */
  accountAddress?: Address;
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
  accountAddress,
  balanceType = BalanceType.Confidential,
  isLoading: isLoadingProp,
  decimalPrecision = 5,
  showSymbol = false,
  className,
  size = 'md',
}) => {
  const account = useCofheAccount();

  // Determine which account address to use
  const effectiveAccountAddress = accountAddress ?? account;

  // Use unified hooks for balance fetching
  const { numericValue: publicBalanceNum, isLoading: isLoadingPublic } = useCofhePublicTokenBalance(
    { token, accountAddress: effectiveAccountAddress, displayDecimals: decimalPrecision },
    {
      enabled: balanceType === BalanceType.Public,
    }
  );

  const {
    formatted: confidentialBalanceFormatted,
    isLoading: isLoadingConfidential,
    disabledDueToMissingPermit,
  } = useCofheTokenDecryptedBalance(
    { token, accountAddress: effectiveAccountAddress, displayDecimals: decimalPrecision },
    {
      enabled: balanceType === BalanceType.Confidential,
    }
  );

  // Determine token symbol
  const displaySymbol = useMemo(() => {
    // For public balance of wrapped tokens, show the erc20Pair symbol
    const erc20Pair = token?.extensions.fhenix.erc20Pair;
    const isWrappedToken = token?.extensions.fhenix.confidentialityType === 'wrapped';
    if (balanceType === BalanceType.Public && isWrappedToken && erc20Pair?.symbol) return erc20Pair.symbol;
    if (token) return token.symbol;
  }, [balanceType, token]);

  // Determine if we're loading
  const isLoading = useMemo(() => {
    return balanceType === BalanceType.Public ? isLoadingPublic : isLoadingConfidential;
  }, [balanceType, isLoadingPublic, isLoadingConfidential]);

  // Format balance
  const displayBalance = useMemo(() => {
    // Public or confidential balance from hooks
    if (balanceType === BalanceType.Confidential) return confidentialBalanceFormatted;

    return publicBalanceNum.toFixed(decimalPrecision);
  }, [balanceType, confidentialBalanceFormatted, publicBalanceNum, decimalPrecision]);

  return (
    <TokenBalanceView
      className={className}
      size={size}
      hidden={disabledDueToMissingPermit}
      isLoading={isLoading}
      formattedBalance={displayBalance}
      symbol={showSymbol ? displaySymbol : undefined}
    />
  );
};

export const TokenBalanceView: React.FC<
  Pick<TokenBalanceProps, 'className' | 'size'> & {
    formattedBalance?: string;
    symbol?: string;
    isLoading?: boolean;
    hidden?: boolean;
  }
> = ({ className, size = 'md', formattedBalance, symbol, isLoading, hidden }) => {
  return (
    <span className={cn(sizeClasses[size], 'font-medium fnx-text-primary', className)}>
      {hidden ? <ConfidentialValuePlaceholder /> : isLoading ? <LoadingDots size={size} /> : formattedBalance}
      {symbol && ` ${symbol}`}
    </span>
  );
};

const ConfidentialValuePlaceholder: React.FC = () => {
  const navigateToGeneratePermit = useCofheCreatePermit({
    ReasonBody: CREATE_PERMITT_BODY_BY_ERROR_CAUSE[ErrorCause.AttemptToFetchConfidentialBalance],
  });

  return (
    <span
      className="cursor-pointer hover:underline"
      onClick={(e) => {
        e.stopPropagation();
        navigateToGeneratePermit();
      }}
    >
      {'* * *'}
    </span>
  );
};
