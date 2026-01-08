import type { Address } from 'viem';
import { useCofheTokenDecryptedBalance } from '../../../hooks/useCofheTokenDecryptedBalance';
import { useCofheAccount } from '../../../hooks/useCofheConnection';
import { type Token } from '../../../hooks/useCofheTokenLists';
import { TokenBalanceView } from './TokenBalanceView';

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
