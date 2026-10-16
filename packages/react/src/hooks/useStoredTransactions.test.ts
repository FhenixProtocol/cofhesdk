import { beforeEach, describe, expect, it } from 'vitest';
import {
  TransactionActionType,
  TransactionStatus,
  useTransactionStore,
  type Transaction,
} from '@/stores/transactionStore';

const TOKEN = {
  address: '0x1111111111111111111111111111111111111111' as const,
  decimals: 6,
  name: 'Test',
  symbol: 'TST',
  chainId: 11155111,
};

const ACCOUNT = '0x2222222222222222222222222222222222222222' as const;

/** Same account filter as `useStoredTransactions` (after the legacy-persist guard). */
function filterByAccount(txs: Transaction[], account?: string): Transaction[] {
  return txs.filter((tx) => {
    if (account && tx.account && tx.account.toLowerCase() !== account.toLowerCase()) return false;
    return true;
  });
}

/** Pre-fix filter that throws on legacy txs missing `account`. */
function filterByAccountLegacy(txs: Transaction[], account?: string): Transaction[] {
  return txs.filter((tx) => {
    if (account && tx.account.toLowerCase() !== account.toLowerCase()) return false;
    return true;
  });
}

function seedLegacyTxWithoutAccount() {
  useTransactionStore.setState({
    transactions: {
      11155111: {
        '0xabc': {
          hash: '0xabc',
          status: TransactionStatus.Pending,
          timestamp: 1,
          chainId: 11155111,
          account: undefined as unknown as `0x${string}`,
          actionType: TransactionActionType.Shield,
          token: TOKEN as never,
          tokenAmount: 1n,
        } as Transaction,
      },
    },
  });
}

describe('useStoredTransactions account filter', () => {
  beforeEach(() => {
    useTransactionStore.setState({ transactions: {} });
  });

  it('legacy filter throws TypeError when account is missing on a persisted tx', () => {
    seedLegacyTxWithoutAccount();
    const txs = useTransactionStore.getState().getAllTransactions(11155111);
    expect(txs).toHaveLength(1);
    expect(() => filterByAccountLegacy(txs, ACCOUNT)).toThrow(TypeError);
  });

  it('guarded filter keeps legacy txs and does not throw', () => {
    seedLegacyTxWithoutAccount();
    const txs = useTransactionStore.getState().getAllTransactions(11155111);
    expect(() => filterByAccount(txs, ACCOUNT)).not.toThrow();
    expect(filterByAccount(txs, ACCOUNT)).toHaveLength(1);
  });
});
