import { useCofheCreatePermit } from '@/hooks/permits/useCofheCreatePermit';
import { CREATE_PERMITT_BODY_BY_ERROR_CAUSE } from '@/providers/errors';
import { cn, ErrorCause } from '@/utils';
import { LoadingDots } from './LoadingDots';

const sizeClasses = {
  sm: 'text-sm',
  md: 'text-base',
  lg: 'text-xl',
  xl: 'text-2xl',
};

type TokenBalanceViewProps = {
  className?: string;
  size?: 'sm' | 'md' | 'lg' | 'xl';
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
