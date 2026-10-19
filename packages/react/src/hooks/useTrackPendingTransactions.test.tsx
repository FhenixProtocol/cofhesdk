import { renderToString } from 'react-dom/server';
import type { TransactionReceipt } from 'viem';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { TransactionActionType, TransactionStatus, useTransactionStore } from '@/stores/transactionStore';
import type { ConfidentialToken } from '@/types/token';

const CHAIN_ID = 84532;
const ACCOUNT = '0x00000000000000000000000000000000000000a1';
const TX_HASH = '0x1111111111111111111111111111111111111111111111111111111111111111';
const ZERO_BLOCK_HASH = '0x0000000000000000000000000000000000000000000000000000000000000000';

const mocks = vi.hoisted(() => {
  // The transaction store is persisted; give it an in-memory localStorage.
  const storage = new Map<string, string>();
  Object.defineProperty(globalThis, 'localStorage', {
    configurable: true,
    value: {
      getItem: (key: string) => storage.get(key) ?? null,
      setItem: (key: string, value: string) => void storage.set(key, value),
      removeItem: (key: string) => void storage.delete(key),
    },
  });

  return {
    queries: [] as Array<{ queryFn: (ctx: { signal: AbortSignal }) => Promise<unknown> }>,
    waitForTransactionReceipt: vi.fn(),
    resolveReceiptBlockHash: vi.fn(),
    invalidateQueries: vi.fn(),
    onTransactionMined: vi.fn(),
    onWatchReceiptFailure: vi.fn(),
  };
});

vi.mock('@/providers', () => ({
  useInternalQueries: ({ queries }: { queries: typeof mocks.queries }) => {
    mocks.queries = queries;
    return [];
  },
  useInternalQueryClient: () => ({ invalidateQueries: mocks.invalidateQueries }),
}));

vi.mock('@/utils/resolveReceiptBlockHash', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/utils/resolveReceiptBlockHash')>()),
  resolveReceiptBlockHash: mocks.resolveReceiptBlockHash,
}));

vi.mock('./useCofheConnection', () => ({
  useCofhePublicClient: () => ({ waitForTransactionReceipt: mocks.waitForTransactionReceipt }),
}));

vi.mock('./usePendingTransactions', async () => {
  const store = await import('@/stores/transactionStore');
  return {
    usePendingTransactions: () =>
      store.useTransactionStore
        .getState()
        .getAllTransactions(CHAIN_ID, ACCOUNT)
        .filter((tx) => tx.status === store.TransactionStatus.Pending),
  };
});

vi.mock('./useTransactionGlobalLifecycle', () => ({
  useTransactionGlobalLifecycle: () => ({
    onTransactionSubmitted: () => {},
    onTransactionMined: mocks.onTransactionMined,
    onWatchReceiptFailure: mocks.onWatchReceiptFailure,
  }),
}));

import { useTrackPendingTransactions } from './useTrackPendingTransactions';

const token: ConfidentialToken = {
  chainId: CHAIN_ID,
  address: '0x3Cdcdd0EB7311a59fDe92D44B01165B2Ca2019C4',
  name: 'fhETH',
  symbol: 'fhETH',
  decimals: 6,
  extensions: {
    fhenix: {
      confidentialityType: 'wrappedNative',
      confidentialValueType: 'uint64',
      erc20Pair: { address: '0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee', symbol: 'ETH', decimals: 18 },
    },
  },
};

function minedReceipt(status: 'success' | 'reverted') {
  return {
    transactionHash: TX_HASH,
    blockHash: ZERO_BLOCK_HASH,
    blockNumber: 123n,
    status,
  } as unknown as TransactionReceipt;
}

function Probe() {
  useTrackPendingTransactions();
  return null;
}

async function runReceiptQuery(signal = new AbortController().signal) {
  renderToString(<Probe />);
  expect(mocks.queries).toHaveLength(1);
  await mocks.queries[0]!.queryFn({ signal }).catch(() => undefined);
  return useTransactionStore.getState().getTransaction(CHAIN_ID, TX_HASH)?.status;
}

describe('useTrackPendingTransactions', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useTransactionStore.setState({ transactions: {} });
    useTransactionStore.getState().addTransaction({
      hash: TX_HASH,
      token,
      tokenAmount: 1_000_000n,
      chainId: CHAIN_ID,
      actionType: TransactionActionType.Shield,
      account: ACCOUNT,
    });
    mocks.resolveReceiptBlockHash.mockRejectedValue(new Error('resolveReceiptBlockHash: gave up after 60000ms'));
  });

  it('confirms a successful receipt whose blockHash never resolves', async () => {
    mocks.waitForTransactionReceipt.mockResolvedValue(minedReceipt('success'));

    expect(await runReceiptQuery()).toBe(TransactionStatus.Confirmed);
    expect(mocks.onTransactionMined).toHaveBeenCalledTimes(1);
    // Without a real block hash, invalidation falls back to a plain invalidateQueries call.
    expect(mocks.invalidateQueries).toHaveBeenCalled();
  });

  it('still marks a reverted receipt as failed', async () => {
    mocks.waitForTransactionReceipt.mockResolvedValue(minedReceipt('reverted'));

    expect(await runReceiptQuery()).toBe(TransactionStatus.Failed);
    expect(mocks.onTransactionMined).toHaveBeenCalledTimes(1);
  });

  it('keeps the tx pending when the query is cancelled while resolving the blockHash', async () => {
    mocks.waitForTransactionReceipt.mockResolvedValue(minedReceipt('success'));
    const controller = new AbortController();
    mocks.resolveReceiptBlockHash.mockImplementation(async () => {
      controller.abort();
      throw Object.assign(new Error('Aborted'), { name: 'AbortError' });
    });

    expect(await runReceiptQuery(controller.signal)).toBe(TransactionStatus.Pending);
    expect(mocks.onTransactionMined).not.toHaveBeenCalled();
  });

  it('marks the tx failed when the receipt cannot be fetched', async () => {
    mocks.waitForTransactionReceipt.mockRejectedValue(new Error('rpc down'));

    expect(await runReceiptQuery()).toBe(TransactionStatus.Failed);
    expect(mocks.onWatchReceiptFailure).toHaveBeenCalledTimes(1);
  });
});
