import { useMemo } from 'react';
import type { Address } from 'viem';
import { useCofheTokenDecryptedBalance } from '../../../hooks/useCofheTokenDecryptedBalance';
import { useCofheAccount } from '../../../hooks/useCofheConnection';
import { type Token } from '../../../hooks/useCofheTokenLists';
import { cn } from '../../../utils/cn';
import { LoadingDots } from './LoadingDots';
import { CREATE_PERMITT_BODY_BY_ERROR_CAUSE } from '@/providers/errors';
import { ErrorCause } from '@/utils/errors';
import { useCofheCreatePermit } from '@/hooks/permits/useCofheCreatePermit';
import { useCofheTokenPublicBalance } from '@/hooks/useCofheTokenPublicBalance';

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
  balanceType: BalanceType;

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

function getPublicTokenSymbol(token: Token | undefined): string | undefined {
  // For public balance of wrapped tokens, show the erc20Pair symbol
  const erc20Pair = token?.extensions.fhenix.erc20Pair;
  const isWrappedToken = token?.extensions.fhenix.confidentialityType === 'wrapped';
  if (isWrappedToken && erc20Pair?.symbol) return erc20Pair.symbol;

  // dual
  if (token) return token.symbol;
  return undefined;
}
export const TokenBalance: React.FC<TokenBalanceProps> = ({
  token,
  accountAddress,
  balanceType,
  decimalPrecision = 5,
  showSymbol = false,
  className,
  size = 'md',
}) => {
  const account = useCofheAccount();

  // Determine which account address to use
  const effectiveAccountAddress = accountAddress ?? account;

  // Use unified hooks for balance fetching
  const { data: { formatted: publicBalanceFormatted } = {}, isLoading: isLoadingPublic } = useCofheTokenPublicBalance(
    { token, accountAddress: effectiveAccountAddress, displayDecimals: decimalPrecision },
    {
      enabled: balanceType === BalanceType.Public,
    }
  );

  const {
    data: { formatted: confidentialBalanceFormatted } = {},
    isLoading: isLoadingConfidential,
    disabledDueToMissingPermit,
  } = useCofheTokenDecryptedBalance(
    { token, accountAddress: effectiveAccountAddress, displayDecimals: decimalPrecision },
    {
      enabled: balanceType === BalanceType.Confidential,
    }
  );

  const balanceViewProps: Pick<TokenBalanceViewProps, 'formattedBalance' | 'isLoading' | 'symbol'> = useMemo(() => {
    // prepare props based on balance type - confidential or public
    if (balanceType === BalanceType.Public) {
      return {
        formattedBalance: publicBalanceFormatted,
        isLoading: isLoadingPublic,
        symbol: showSymbol ? getPublicTokenSymbol(token) : undefined,
      };
    } else {
      return {
        formattedBalance: confidentialBalanceFormatted,
        isLoading: isLoadingConfidential,
        symbol: showSymbol ? token?.symbol : undefined,
      };
    }
  }, [
    balanceType,
    publicBalanceFormatted,
    isLoadingPublic,
    confidentialBalanceFormatted,
    isLoadingConfidential,
    showSymbol,
    token,
  ]);
  return (
    <TokenBalanceView
      className={className}
      size={size}
      hidden={disabledDueToMissingPermit}
      isLoading={balanceViewProps.isLoading}
      formattedBalance={balanceViewProps.formattedBalance}
      symbol={balanceViewProps.symbol}
    />
  );
};

type TokenBalanceViewProps = Pick<TokenBalanceProps, 'className' | 'size'> & {
  formattedBalance?: string;
  symbol?: string;
  isLoading?: boolean;
  hidden?: boolean;
};
export const TokenBalanceView: React.FC<TokenBalanceViewProps> = ({
  className,
  size = 'md',
  formattedBalance,
  symbol,
  isLoading,
  hidden,
}) => {
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
