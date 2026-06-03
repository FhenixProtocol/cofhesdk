import { useCallback } from 'react';
import { type NewTransaction, useTransactionStore } from '@/stores/transactionStore';

export type AddCofheTransactionInput = NewTransaction;

export function addCofheTransaction(transaction: AddCofheTransactionInput) {
  useTransactionStore.getState().addTransaction(transaction);
}

export function useCofheTransactions() {
  const transactions = useTransactionStore((state) => state.transactions);
  const addTransaction = useCallback((transaction: AddCofheTransactionInput) => {
    addCofheTransaction(transaction);
  }, []);
  const clearTransactions = useTransactionStore((state) => state.clearTransactions);
  const getTransaction = useTransactionStore((state) => state.getTransaction);
  const getAllTransactions = useTransactionStore((state) => state.getAllTransactions);
  const getAllTransactionsByToken = useTransactionStore((state) => state.getAllTransactionsByToken);

  return {
    transactions,
    addTransaction,
    clearTransactions,
    getTransaction,
    getAllTransactions,
    getAllTransactionsByToken,
  };
}
