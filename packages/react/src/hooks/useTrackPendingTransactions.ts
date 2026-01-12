import { TransactionStatus, useTransactionStore } from '@/stores/transactionStore';
import { useCofheAccount, useCofheChainId, useCofhePublicClient } from './useCofheConnection';
import { useInternalQueries } from '@/providers';
import { assert } from 'ts-essentials';

export function useTrackPendingTransactions() {
  // Batch check pending transactions using react-query's useQueries
  const chainId = useCofheChainId();
  const account = useCofheAccount();
  const publicClient = useCofhePublicClient();
  const getAllTxs = useTransactionStore((state) => state.getAllTransactions);
  const pendingTxs = chainId
    ? getAllTxs(chainId, account ?? undefined).filter((v) => v.status === TransactionStatus.Pending)
    : [];
  console.log('All transactions:', chainId ? getAllTxs(chainId, account) : undefined);
  useInternalQueries({
    queries: pendingTxs.map((tx) => ({
      queryKey: ['tx-receipt', tx.chainId, tx.hash],
      queryFn: async () => {
        assert(publicClient, 'Public client is guaranteed by enabled condition');
        try {
          const receipt = await publicClient.waitForTransactionReceipt({ hash: tx.hash as `0x${string}` });

          const status = receipt.status === 'success' ? TransactionStatus.Confirmed : TransactionStatus.Failed;
          useTransactionStore.getState().updateTransactionStatus(tx.chainId, tx.hash, status);

          return receipt;
        } catch (e) {
          useTransactionStore.getState().updateTransactionStatus(tx.chainId, tx.hash, TransactionStatus.Failed);
          throw e;
        }
      },
      enabled: !!publicClient && pendingTxs.length > 0,

      refetchOnWindowFocus: false,
      refetchOnReconnect: true,
    })),
  });
}
