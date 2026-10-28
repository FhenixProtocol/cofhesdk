import { beforeEach, describe, expect, it } from 'vitest';
import { TransactionActionType, TransactionStatus, useTransactionStore } from './transactionStore';

const TOKEN = {
  address: '0x1111111111111111111111111111111111111111' as const,
  decimals: 6,
  name: 'Test',
  symbol: 'TST',
  chainId: 11155111,
};

const ACCOUNT = '0x2222222222222222222222222222222222222222' as const;

function seedLegacyTxWithoutAccount() {
  useTransactionStore.setState({
    transactions: {
      11155111: {
        '0xabc': {
          hash: '0xabc',
          status: TransactionStatus.Pending,
          timestamp: 1,
          chainId: 11155111,
          // Legacy persisted entries may omit account
          account: undefined as unknown as `0x${string}`,
          actionType: TransactionActionType.Shield,
          token: TOKEN as never,
          tokenAmount: 1n,
        },
      },
    },
  });
}

describe('transactionStore account filters', () => {
  beforeEach(() => {
    useTransactionStore.setState({ transactions: {} });
  });

  it('getAllTransactionsByToken matches getAllTransactions when account is missing on a legacy tx', () => {
    seedLegacyTxWithoutAccount();

    const byToken = useTransactionStore.getState().getAllTransactionsByToken(11155111, TOKEN.address, ACCOUNT);
    const all = useTransactionStore.getState().getAllTransactions(11155111, ACCOUNT);

    expect(byToken).toHaveLength(all.length);
    expect(byToken.map((tx) => tx.hash)).toEqual(all.map((tx) => tx.hash));
  });

  it('getAllTransactionsByToken does not throw TypeError on missing account', () => {
    seedLegacyTxWithoutAccount();

    expect(() =>
      useTransactionStore.getState().getAllTransactionsByToken(11155111, TOKEN.address, ACCOUNT)
    ).not.toThrow();
  });
});
