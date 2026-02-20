import { useMemo } from 'react';

import { formatUnits } from 'viem';

import { HashLink } from '../components/HashLink';
import { cn } from '@/utils/cn';

import { useCofheAccount } from '@/hooks/useCofheConnection';
import { useStoredTransactions } from '@/hooks/useStoredTransactions.js';
import { actionToString } from '@/stores/transactionStore';

import type { Token } from '@/types/token';

interface TokenInfoTransactionHistoryHeaderProps {
  token: Token;
}

export const TokenInfoTransactionHistoryHeader: React.FC<TokenInfoTransactionHistoryHeaderProps> = ({ token }) => {
  return (
    <div className="flex items-center justify-between">
      <h3 className="text-sm font-bold fnx-text-primary">Activity</h3>
      <HashLink type="token" hash={token.address} chainId={token.chainId} extraShort />
      {token.extensions.fhenix.erc20Pair?.address && (
        <HashLink type="token" hash={token.extensions.fhenix.erc20Pair.address} chainId={token.chainId} extraShort />
      )}
    </div>
  );
};

interface TokenInfoTransactionHistoryProps {
  token: Token;
  priceUsd?: number;
}

const money = (n: number) =>
  n.toLocaleString(undefined, {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });

export const TokenInfoTransactionHistory: React.FC<TokenInfoTransactionHistoryProps> = ({ token, priceUsd }) => {
  const account = useCofheAccount();

  const { filteredTxs: tokenTxs } = useStoredTransactions({
    chainId: token.chainId,
    account,
    filter: (tx) => tx.token.address.toLowerCase() === token.address.toLowerCase(),
  });

  const activity = useMemo(() => {
    return tokenTxs
      .slice()
      .sort((a, b) => b.timestamp - a.timestamp)
      .map((tx) => {
        const amountToken = parseFloat(formatUnits(tx.tokenAmount, tx.token.decimals));
        const amountUsd =
          typeof priceUsd === 'number' && Number.isFinite(amountToken) ? amountToken * priceUsd : undefined;

        return {
          kind: actionToString(tx.actionType),
          amountUsd,
          amountToken: Number.isFinite(amountToken) ? amountToken : 0,
        };
      });
  }, [tokenTxs, priceUsd]);

  return (
    <div className="space-y-2">
      <div className="p-3">
        {!activity || activity.length === 0 ? (
          <div className="py-6 text-center">
            <p className="text-sm fnx-text-primary opacity-60">No activity found</p>
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            {activity.map((item, idx) => {
              return (
                <div key={idx} className="flex items-start justify-between">
                  <div className="flex items-start gap-2">
                    <div
                      className={cn(
                        'w-8 h-8 rounded-full',
                        'bg-cyan-200/70 dark:bg-cyan-900/40',
                        'flex items-center justify-center'
                      )}
                    />
                    <div className="flex flex-col">
                      <p className="text-sm font-bold fnx-text-primary">{item.kind}</p>
                    </div>
                  </div>

                  <div className="flex flex-col items-end">
                    <p className="text-sm font-bold fnx-text-primary">
                      {typeof item.amountUsd === 'number' ? money(item.amountUsd) : '--'}
                    </p>
                    <p className="text-xxxs opacity-70">
                      {item.amountToken} {token.symbol}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};
