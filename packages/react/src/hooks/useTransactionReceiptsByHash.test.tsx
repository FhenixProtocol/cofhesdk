import { renderToString } from 'react-dom/server';
import type { TransactionReceipt } from 'viem';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const CONNECTED_CHAIN_ID = 84532;
const OTHER_CHAIN_ID = 11155111;
const TX_HASH = '0x1111111111111111111111111111111111111111111111111111111111111111';

type CapturedQuery = {
  enabled: boolean;
  queryKey: readonly unknown[];
  queryFn: () => Promise<TransactionReceipt>;
};

const mocks = vi.hoisted(() => ({
  queries: [] as CapturedQuery[],
  publicClient: undefined as { getTransactionReceipt: ReturnType<typeof vi.fn> } | undefined,
  getTransactionReceipt: vi.fn(),
}));

vi.mock('@/providers', () => ({
  useInternalQueries: ({ queries }: { queries: CapturedQuery[] }) => {
    mocks.queries = queries;
    return [];
  },
}));

vi.mock('./useCofheConnection', () => ({
  useCofheConnection: () => ({ publicClient: mocks.publicClient, chainId: CONNECTED_CHAIN_ID }),
}));

import { useTransactionReceiptsByHash } from './useTransactionReceiptsByHash';

function Probe({ chainId, enabled = true }: { chainId?: number; enabled?: boolean }) {
  useTransactionReceiptsByHash({ hashes: new Set([TX_HASH]), chainId, enabled });
  return null;
}

describe('useTransactionReceiptsByHash', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.queries = [];
    mocks.publicClient = { getTransactionReceipt: mocks.getTransactionReceipt };
  });

  it('uses the connected chain when no explicit chain is provided', () => {
    renderToString(<Probe />);

    expect(mocks.queries).toHaveLength(1);
    expect(mocks.queries[0]?.enabled).toBe(true);
    expect(mocks.queries[0]?.queryKey).toStrictEqual(['tx-receipt', CONNECTED_CHAIN_ID, TX_HASH]);
  });

  it('reads through the connected client when an explicit chain matches', async () => {
    const receipt = { transactionHash: TX_HASH } as unknown as TransactionReceipt;
    mocks.getTransactionReceipt.mockResolvedValue(receipt);
    renderToString(<Probe chainId={CONNECTED_CHAIN_ID} />);

    expect(mocks.queries[0]?.enabled).toBe(true);
    await expect(mocks.queries[0]?.queryFn()).resolves.toBe(receipt);
    expect(mocks.getTransactionReceipt).toHaveBeenCalledWith({ hash: TX_HASH });
  });

  it('stays disabled when an explicit chain differs from the connected chain', () => {
    renderToString(<Probe chainId={OTHER_CHAIN_ID} />);

    expect(mocks.queries[0]?.enabled).toBe(false);
    expect(mocks.queries[0]?.queryKey).toStrictEqual(['tx-receipt', OTHER_CHAIN_ID, TX_HASH]);
    expect(mocks.getTransactionReceipt).not.toHaveBeenCalled();
  });

  it('respects enabled: false on the connected chain', () => {
    renderToString(<Probe chainId={CONNECTED_CHAIN_ID} enabled={false} />);

    expect(mocks.queries[0]?.enabled).toBe(false);
  });
});
