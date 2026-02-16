import { useCofheNavigateToCreatePermit } from '@/hooks/permits/useCofheNavigateToCreatePermit';
import { cn } from '@/utils';
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
  isFetching?: boolean;
  hidden?: boolean;
};
export const TokenBalanceView: React.FC<TokenBalanceViewProps> = ({
  className,
  size = 'md',
  formattedBalance,
  symbol,
  isFetching,
  hidden,
}) => {
  return (
    <span className={cn(sizeClasses[size], 'font-medium fnx-text-primary', className)}>
      {hidden ? <ConfidentialValuePlaceholder /> : isFetching ? <LoadingDots size={size} /> : formattedBalance}
      {symbol && ` ${symbol}`}
    </span>
  );
};

const ConfidentialValuePlaceholder: React.FC = () => {
  const navigateToGeneratePermit = useCofheNavigateToCreatePermit();

  return (
    <span
      className="cursor-pointer hover:underline"
      onClick={(e) => {
        e.stopPropagation();
        navigateToGeneratePermit({
          cause: 'clicked_on_confidential_balance',
        });
      }}
    >
      {'* * *'}
    </span>
  );
};
