import { formatUnits } from 'viem';
import { cn } from '../../../utils/cn.js';
import { GoArrowUpRight } from 'react-icons/go';
import { TbShieldPlus, TbShieldMinus, TbShieldCheck } from 'react-icons/tb';
import {
  type Transaction,
  TransactionStatus,
  TransactionActionType,
  actionToString,
  statusToString,
} from '../../../stores/transactionStore.js';
import { formatRelativeTime } from '../../../utils/utils.js';
import { HashLink } from './HashLink.js';

interface TransactionItemProps {
  transaction: Transaction;
}

const ActionIcon: React.FC<{ actionType: TransactionActionType }> = ({ actionType }) => {
  const iconClassName = 'w-5 h-5';

  switch (actionType) {
    case TransactionActionType.ShieldSend:
      return <GoArrowUpRight className={iconClassName} />;
    case TransactionActionType.Shield:
      return <TbShieldPlus className={iconClassName} />;
    case TransactionActionType.Unshield:
      return <TbShieldMinus className={iconClassName} />;
    case TransactionActionType.Claim:
      return <TbShieldCheck className={iconClassName} />;
    default:
      return <GoArrowUpRight className={iconClassName} />;
  }
};

export const TransactionItem: React.FC<TransactionItemProps> = ({ transaction }) => {
  const statusColorClass =
    transaction.status === TransactionStatus.Pending
      ? 'text-yellow-600 dark:text-yellow-400'
      : transaction.status === TransactionStatus.Confirmed
        ? 'text-green-600 dark:text-green-400'
        : 'text-red-600 dark:text-red-400';

  return (
    <div className="fnx-card-bg p-3 rounded-lg border fnx-dropdown-border">
      <div className="flex items-start gap-3">
        {/* Action Icon */}
        <div className="w-8 h-8 rounded-full fnx-icon-bg flex items-center justify-center flex-shrink-0 fnx-text-primary">
          <ActionIcon actionType={transaction.actionType} />
        </div>

        {/* Transaction Details */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between gap-2">
            <span className="text-sm font-semibold fnx-text-primary">{actionToString(transaction.actionType)}</span>
            <span className="text-sm font-semibold fnx-text-primary">
              {formatUnits(transaction.tokenAmount, transaction.tokenDecimals)} {transaction.tokenSymbol}
            </span>
          </div>

          <div className="flex items-center justify-between gap-2 mt-1">
            <span className={cn('text-xs font-medium', statusColorClass)}>{statusToString(transaction.status)}</span>
            <span className="text-xs fnx-text-primary opacity-60">{formatRelativeTime(transaction.timestamp)}</span>
          </div>

          <div className="mt-1">
            <HashLink type="tx" hash={transaction.hash} chainId={transaction.chainId} copyable />
          </div>
        </div>
      </div>
    </div>
  );
};
