import type { Address } from 'viem';
import { useCofheTokenDecryptedBalance } from '@/hooks/useCofheTokenDecryptedBalance';
import { useCofheAccount } from '@/hooks/useCofheConnection';
import { type Token } from '@/hooks/useCofheTokenLists';
import { TokenBalanceView } from './TokenBalanceView';
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

const DEFAULT_DISPLAY_DECIMALS = 5;

export const CofheTokenConfidentialBalance: React.FC<TokenBalanceProps> = ({
  token,
  accountAddress,
  decimalPrecision = DEFAULT_DISPLAY_DECIMALS,
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
    isFetching: isFetchingConfidential,
    disabledDueToMissingPermit,
  } = useCofheTokenDecryptedBalance({
    token,
    accountAddress: effectiveAccountAddress,
    displayDecimals: decimalPrecision,
  });

  return (
    <TokenBalanceView
      className={className}
      size={size}
      hidden={disabledDueToMissingPermit}
      isFetching={isFetchingConfidential}
      formattedBalance={confidentialBalanceFormatted}
      symbol={showSymbol ? token?.symbol : undefined}
    />
  );
};

export const CofheTokenPublicBalance: React.FC<TokenBalanceProps> = ({
  token,
  accountAddress,
  decimalPrecision = DEFAULT_DISPLAY_DECIMALS,
  showSymbol = false,
  className,
  size = 'md',
}) => {
  const account = useCofheAccount();

  const effectiveAccountAddress = accountAddress ?? account;

  const { data: { formatted: publicBalanceFormatted } = {}, isFetching: isFetchingPublic } = useCofheTokenPublicBalance(
    { token, accountAddress: effectiveAccountAddress, displayDecimals: decimalPrecision }
  );

  return (
    <TokenBalanceView
      className={className}
      size={size}
      isFetching={isFetchingPublic}
      formattedBalance={publicBalanceFormatted}
      symbol={showSymbol ? token?.symbol : undefined}
    />
  );
};
