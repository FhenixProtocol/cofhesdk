import { formatUnits } from 'viem';
import { cn } from '../../../utils/cn.js';
import { GoArrowUpRight } from 'react-icons/go';
import { TbShieldPlus, TbShieldMinus, TbShieldCheck } from 'react-icons/tb';
import {
  type Transaction,
  TransactionStatus,
  TransactionActionType,
  actionToString,
  isCustomTransactionActionType,
  statusToString,
} from '../../../stores/transactionStore.js';
import { useCofheContext } from '../../../providers/index.js';
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
    case TransactionActionType.Approve:
      return <GoArrowUpRight className={iconClassName} />;
    default:
      return <GoArrowUpRight className={iconClassName} />;
  }
};

function stringifyPayload(payload: unknown): string {
  try {
    return JSON.stringify(payload, null, 2);
  } catch {
    return String(payload);
  }
}

export const TransactionItem: React.FC<TransactionItemProps> = ({ transaction }) => {
  const { transactionRenderers } = useCofheContext();
  const Renderer = transactionRenderers?.[transaction.actionType];

  if (Renderer) {
    return <Renderer transaction={transaction} />;
  }

  const amountLabel =
    'token' in transaction
      ? `${formatUnits(transaction.tokenAmount, transaction.token.decimals)} ${transaction.token.symbol}`
      : null;

  const statusColorClass =
    transaction.status === TransactionStatus.Pending
      ? 'text-yellow-600 dark:text-yellow-400'
      : transaction.status === TransactionStatus.Confirmed
        ? 'text-green-600 dark:text-green-400'
        : 'text-red-600 dark:text-red-400';

  return (
    <div className="cofhe-card-bg p-3 rounded-lg border cofhe-dropdown-border">
      <div className="flex items-start gap-3">
        {/* Action Icon */}
        <div className="w-8 h-8 rounded-full cofhe-icon-bg flex items-center justify-center flex-shrink-0 cofhe-text-primary">
          <ActionIcon actionType={transaction.actionType} />
        </div>

        {/* Transaction Details */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between gap-2">
            <span className="text-sm font-semibold cofhe-text-primary">
              {actionToString(transaction.actionType, transaction.title)}
            </span>
            {amountLabel ? <span className="text-sm font-semibold cofhe-text-primary">{amountLabel}</span> : null}
          </div>

          <div className="flex items-center justify-between gap-2 mt-1">
            <span className={cn('text-xs font-medium', statusColorClass)}>{statusToString(transaction.status)}</span>
            <span className="text-xs cofhe-text-primary opacity-60">{formatRelativeTime(transaction.timestamp)}</span>
          </div>

          {transaction.description ? (
            <p className="mt-1 text-xs cofhe-text-primary opacity-70">{transaction.description}</p>
          ) : null}

          {isCustomTransactionActionType(transaction.actionType) && transaction.payload !== undefined ? (
            <pre className="mt-2 max-h-24 overflow-auto rounded cofhe-card-bg p-2 text-[10px] cofhe-text-primary opacity-80">
              {stringifyPayload(transaction.payload)}
            </pre>
          ) : null}

          <div className="mt-1">
            <HashLink type="tx" hash={transaction.hash} chainId={transaction.chainId} copyable />
          </div>
        </div>
      </div>
    </div>
  );
};
