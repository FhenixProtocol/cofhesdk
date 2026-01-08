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

interface TokenBalanceProps {
  /** Token object from token list (for non-native tokens) */
  token?: Token;
  /** Account address to fetch balance for */
  accountAddress?: Address;

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

export const CofheTokenPublicBalance: React.FC<TokenBalanceProps> = ({
  token,
  accountAddress,
  decimalPrecision = 5,
  showSymbol = false,
  className,
  size = 'md',
}) => {
  const account = useCofheAccount();

  // Determine which account address to use
  const effectiveAccountAddress = accountAddress ?? account;

  // Use unified hook for public balance fetching
  const { data: { formatted: publicBalanceFormatted } = {}, isLoading: isLoadingPublic } = useCofheTokenPublicBalance(
    { token, accountAddress: effectiveAccountAddress, displayDecimals: decimalPrecision },
    {
      enabled: true,
    }
  );

  return (
    <TokenBalanceView
      className={className}
      size={size}
      isLoading={isLoadingPublic}
      formattedBalance={publicBalanceFormatted}
      symbol={showSymbol ? getPublicTokenSymbol(token) : undefined}
    />
  );
};

export const CofheTokenConfidentialBalance: React.FC<TokenBalanceProps> = ({
  token,
  accountAddress,
  decimalPrecision = 5,
  showSymbol = false,
  className,
  size = 'md',
}) => {
  const account = useCofheAccount();

  // Determine which account address to use
  const effectiveAccountAddress = accountAddress ?? account;

  // Use unified hook for confidential balance fetching
  const {
    data: { formatted: confidentialBalanceFormatted } = {},
    isLoading: isLoadingConfidential,
    disabledDueToMissingPermit,
  } = useCofheTokenDecryptedBalance(
    { token, accountAddress: effectiveAccountAddress, displayDecimals: decimalPrecision },
    {
      enabled: true,
    }
  );

  return (
    <TokenBalanceView
      className={className}
      size={size}
      hidden={disabledDueToMissingPermit}
      isLoading={isLoadingConfidential}
      formattedBalance={confidentialBalanceFormatted}
      symbol={showSymbol ? token?.symbol : undefined}
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
