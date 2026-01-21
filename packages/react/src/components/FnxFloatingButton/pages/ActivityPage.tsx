import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import { useTransactionStore } from '../../../stores/transactionStore.js';
import { useCofheChainId, useCofheAccount } from '@/hooks/useCofheConnection.js';
import { TransactionItem } from '../components/TransactionItem.js';
import { usePortalNavigation } from '@/stores';
import { useStoredTransactions } from '@/hooks/useStoredTransactions.js';

export const ActivityPage: React.FC = () => {
  const { navigateBack } = usePortalNavigation();
  const chainId = useCofheChainId();
  const account = useCofheAccount();

  const { filteredTxs: transactions } = useStoredTransactions({
    chainId,
    account,
  });

  return (
    <div className="fnx-text-primary space-y-4">
      {/* Back Button */}
      <button
        type="button"
        onClick={navigateBack}
        className="flex items-center gap-1 text-sm hover:opacity-80 transition-opacity mb-2"
      >
        <ArrowBackIcon style={{ fontSize: 16 }} />
        <p className="text-sm font-medium">Activity</p>
      </button>

      {transactions.length === 0 ? (
        <div className="py-8 text-center">
          <p className="text-sm fnx-text-primary opacity-60">No transactions found</p>
        </div>
      ) : (
        <div className="space-y-2 max-h-64 overflow-y-auto">
          {transactions.map((tx) => (
            <TransactionItem key={tx.hash} transaction={tx} />
          ))}
        </div>
      )}
    </div>
  );
};
