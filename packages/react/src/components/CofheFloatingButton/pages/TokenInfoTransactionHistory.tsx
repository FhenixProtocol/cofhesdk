import { useMemo } from 'react';

import { formatUnits } from 'viem';

import { HashLink } from '../components/HashLink';
import { cn } from '@/utils/cn';

import { useCofheTokenTransactions } from '@/hooks/useCofheTokenTransactions';
import { actionToString } from '@/stores/transactionStore';

import type { ConfidentialToken } from '@/types/token';

interface TokenInfoTransactionHistoryHeaderProps {
  token: ConfidentialToken;
}

export const TokenInfoTransactionHistoryHeader: React.FC<TokenInfoTransactionHistoryHeaderProps> = ({ token }) => {
  return (
    <div className="flex items-center justify-between">
      <h3 className="text-sm font-bold cofhe-text-primary">Activity</h3>
      <HashLink type="token" hash={token.address} chainId={token.chainId} extraShort />
      {token.extensions.fhenix.erc20Pair?.address && (
        <HashLink type="token" hash={token.extensions.fhenix.erc20Pair.address} chainId={token.chainId} extraShort />
      )}
    </div>
  );
};

interface TokenInfoTransactionHistoryProps {
  token: ConfidentialToken;
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
  const { transactions: tokenTxs } = useCofheTokenTransactions({ token });

  const activity = useMemo(() => {
    return tokenTxs.map((tx) => {
      if (!('token' in tx)) {
        return {
          kind: actionToString(tx.actionType, tx.title),
          description: tx.description,
        };
      }

      const amountToken = parseFloat(formatUnits(tx.tokenAmount, tx.token.decimals));
      const amountUsd =
        typeof priceUsd === 'number' && Number.isFinite(amountToken) ? amountToken * priceUsd : undefined;

      return {
        kind: actionToString(tx.actionType, tx.title),
        description: tx.description,
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
            <p className="text-sm cofhe-text-primary opacity-60">No activity found</p>
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
                      <p className="text-sm font-bold cofhe-text-primary">{item.kind}</p>
                      {item.description ? <p className="text-xs opacity-70">{item.description}</p> : null}
                    </div>
                  </div>

                  {'amountToken' in item ? (
                    <div className="flex flex-col items-end">
                      <p className="text-sm font-bold cofhe-text-primary">
                        {typeof item.amountUsd === 'number' ? money(item.amountUsd) : '--'}
                      </p>
                      <p className="text-xxxs opacity-70">
                        {item.amountToken} {token.symbol}
                      </p>
                    </div>
                  ) : null}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};
