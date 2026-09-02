import { QueryClient, QueryObserver, type UseQueryOptions } from '@tanstack/react-query';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { PublicClient } from 'viem';
import { createCofheReadContractQueryOptions } from './useCofheReadContract';
import { invalidateOnceMined } from './useCofheWriteContract';

// useCofheReadContracts runs each entry of its dynamic-length batch as its own
// query, built with `createCofheReadContractQueryOptions` — the exact options
// the singular hook uses. These tests drive that per-entry pipeline against a
// live QueryClient through the real write-side invalidation
// (`invalidateOnceMined`), demonstrating the main scenarios the plural form
// must support: a mined write refreshes the matching entries (and only those),
// the triggered refetch is block-aware, the block context is one-shot, and
// batch entries share their cache with singular reads.

const CHAIN_ID = 421614;
const OTC = '0x188aB8B383A50c0dB2fBA85F87e488Db4bEeeA2E' as const;
const TOKEN_A = '0x0000000000000000000000000000000000000aaa' as const;
const TOKEN_B = '0x0000000000000000000000000000000000000bbb' as const;
const MINED_BLOCK_HASH = '0x1111111111111111111111111111111111111111111111111111111111111111' as const;
const TX_HASH = '0x2222222222222222222222222222222222222222222222222222222222222222' as const;

const OTC_ABI = [
  {
    type: 'function',
    name: 'getTokenConfig',
    stateMutability: 'view',
    inputs: [{ name: 'token', type: 'address' }],
    outputs: [{ type: 'uint256' }],
  },
  {
    type: 'function',
    name: 'getOrder',
    stateMutability: 'view',
    inputs: [{ name: 'orderId', type: 'uint256' }],
    outputs: [{ type: 'uint256' }],
  },
] as const;

type MockedClient = {
  client: PublicClient;
  readContract: ReturnType<typeof vi.fn>;
  request: ReturnType<typeof vi.fn>;
  /** Live on-chain state: `functionName:arg` -> value. Mutate to simulate a write landing. */
  values: Map<string, bigint>;
};

function mockPublicClient(options: { blockKnownOnCall?: number } = {}): MockedClient {
  const values = new Map<string, bigint>();
  let blockCalls = 0;

  const readContract = vi.fn(async ({ functionName, args }: { functionName: string; args: readonly unknown[] }) => {
    const value = values.get(`${functionName}:${String(args?.[0])}`);
    if (value === undefined) throw new Error(`no mock value for ${functionName}(${String(args?.[0])})`);
    return value;
  });

  const request = vi.fn(async ({ method, params }: { method: string; params: readonly unknown[] }) => {
    if (method !== 'eth_getBlockByHash') throw new Error(`unexpected request ${method}`);
    blockCalls += 1;
    // Simulate a lagging read replica: the node only "knows" the mined block
    // from the N-th eth_getBlockByHash on.
    return blockCalls >= (options.blockKnownOnCall ?? 1) ? { hash: params[0] } : null;
  });

  const waitForTransactionReceipt = vi.fn(async () => ({
    transactionHash: TX_HASH,
    blockHash: MINED_BLOCK_HASH,
    blockNumber: 123n,
    status: 'success',
  }));

  return {
    client: { readContract, request, waitForTransactionReceipt } as unknown as PublicClient,
    readContract,
    request,
    values,
  };
}

/** The per-entry query options useCofheReadContracts builds for one batch entry. */
function entryOptions(
  mocked: MockedClient,
  entry: { functionName: 'getTokenConfig' | 'getOrder'; args: readonly unknown[] },
  extraQueryOptions?: Record<string, unknown>
) {
  return createCofheReadContractQueryOptions({
    enabled: true,
    cofheChainId: CHAIN_ID,
    address: OTC,
    abi: OTC_ABI as never,
    functionName: entry.functionName as never,
    args: entry.args as never,
    requiresACP: false,
    activeACPHash: undefined,
    publicClient: mocked.client as never,
    queryOptions: { retry: false, ...extraQueryOptions } as never,
  }) as UseQueryOptions;
}

function observe(queryClient: QueryClient, options: UseQueryOptions) {
  const observer = new QueryObserver(queryClient, queryClient.defaultQueryOptions(options));
  const unsubscribe = observer.subscribe(() => {});
  return { observer, unsubscribe };
}

async function waitForData(observer: QueryObserver, expected: unknown) {
  // Generous timeout: the block-aware wait polls the node at 1s intervals.
  await vi.waitFor(
    () => {
      expect(observer.getCurrentResult().data).toEqual(expected);
    },
    { timeout: 10_000 }
  );
}

function invalidate(mocked: MockedClient, queryClient: QueryClient, targets: readonly object[]) {
  return invalidateOnceMined({
    publicClient: mocked.client,
    queryClient,
    txHash: TX_HASH,
    targets: targets as never,
    connectedChainId: CHAIN_ID,
  });
}

describe('useCofheReadContracts invalidation scenarios', () => {
  const cleanups: Array<() => void> = [];
  afterEach(() => {
    while (cleanups.length) cleanups.pop()?.();
  });

  function batchOfThree(mocked: MockedClient, queryClient: QueryClient) {
    // A dynamic-length batch like the token-whitelist case: one getTokenConfig
    // per token, plus an unrelated read of the same contract.
    mocked.values.set(`getTokenConfig:${TOKEN_A}`, 1n);
    mocked.values.set(`getTokenConfig:${TOKEN_B}`, 1n);
    mocked.values.set('getOrder:7', 10n);

    const cfgA = observe(queryClient, entryOptions(mocked, { functionName: 'getTokenConfig', args: [TOKEN_A] }));
    const cfgB = observe(queryClient, entryOptions(mocked, { functionName: 'getTokenConfig', args: [TOKEN_B] }));
    const order = observe(queryClient, entryOptions(mocked, { functionName: 'getOrder', args: [7n] }));
    cleanups.push(cfgA.unsubscribe, cfgB.unsubscribe, order.unsubscribe);

    return { cfgA: cfgA.observer, cfgB: cfgB.observer, order: order.observer };
  }

  it('a mined write with a functionName target refreshes every matching entry — and only those', async () => {
    const mocked = mockPublicClient();
    const queryClient = new QueryClient();
    const { cfgA, cfgB, order } = batchOfThree(mocked, queryClient);

    await waitForData(cfgA, 1n);
    await waitForData(cfgB, 1n);
    await waitForData(order, 10n);
    const orderReadsBefore = mocked.readContract.mock.calls.filter(([call]) => call.functionName === 'getOrder').length;

    // The write lands: both token configs change on-chain.
    mocked.values.set(`getTokenConfig:${TOKEN_A}`, 2n);
    mocked.values.set(`getTokenConfig:${TOKEN_B}`, 2n);

    await invalidate(mocked, queryClient, [{ address: OTC, functionName: 'getTokenConfig' }]);

    await waitForData(cfgA, 2n);
    await waitForData(cfgB, 2n);

    // The unrelated entry was not refetched.
    expect(order.getCurrentResult().data).toEqual(10n);
    const orderReadsAfter = mocked.readContract.mock.calls.filter(([call]) => call.functionName === 'getOrder').length;
    expect(orderReadsAfter).toBe(orderReadsBefore);
  });

  it('an address-only target refreshes every read of the contract', async () => {
    const mocked = mockPublicClient();
    const queryClient = new QueryClient();
    const { cfgA, cfgB, order } = batchOfThree(mocked, queryClient);

    await waitForData(cfgA, 1n);
    await waitForData(cfgB, 1n);
    await waitForData(order, 10n);

    mocked.values.set(`getTokenConfig:${TOKEN_A}`, 2n);
    mocked.values.set(`getTokenConfig:${TOKEN_B}`, 2n);
    mocked.values.set('getOrder:7', 20n);

    await invalidate(mocked, queryClient, [{ address: OTC }]);

    await waitForData(cfgA, 2n);
    await waitForData(cfgB, 2n);
    await waitForData(order, 20n);
  });

  it('the triggered refetch is block-aware: it holds out until the serving node knows the mined block', async () => {
    // The node only admits the block on the second eth_getBlockByHash — a
    // lagging read replica.
    const mocked = mockPublicClient({ blockKnownOnCall: 2 });
    const queryClient = new QueryClient();

    mocked.values.set(`getTokenConfig:${TOKEN_A}`, 1n);
    const cfg = observe(queryClient, entryOptions(mocked, { functionName: 'getTokenConfig', args: [TOKEN_A] }));
    cleanups.push(cfg.unsubscribe);

    await waitForData(cfg.observer, 1n);
    // The initial fetch is an ordinary read: no block-awareness involved.
    expect(mocked.request).not.toHaveBeenCalled();

    mocked.values.set(`getTokenConfig:${TOKEN_A}`, 2n);
    await invalidate(mocked, queryClient, [{ address: OTC, functionName: 'getTokenConfig' }]);
    await waitForData(cfg.observer, 2n);

    // It kept polling until the node knew the block, and asked for exactly the
    // mined block hash each round.
    expect(mocked.request.mock.calls.length).toBeGreaterThanOrEqual(2);
    for (const [call] of mocked.request.mock.calls) {
      expect(call).toMatchObject({ method: 'eth_getBlockByHash', params: [MINED_BLOCK_HASH, false] });
    }
  }, 15_000);

  it('the block context is one-shot: a later refetch reads plainly', async () => {
    const mocked = mockPublicClient();
    const queryClient = new QueryClient();

    mocked.values.set(`getTokenConfig:${TOKEN_A}`, 1n);
    const cfg = observe(queryClient, entryOptions(mocked, { functionName: 'getTokenConfig', args: [TOKEN_A] }));
    cleanups.push(cfg.unsubscribe);
    await waitForData(cfg.observer, 1n);

    mocked.values.set(`getTokenConfig:${TOKEN_A}`, 2n);
    await invalidate(mocked, queryClient, [{ address: OTC, functionName: 'getTokenConfig' }]);
    await waitForData(cfg.observer, 2n);
    const blockLookupsAfterInvalidation = mocked.request.mock.calls.length;

    mocked.values.set(`getTokenConfig:${TOKEN_A}`, 3n);
    await cfg.observer.refetch();
    await waitForData(cfg.observer, 3n);

    expect(mocked.request.mock.calls.length).toBe(blockLookupsAfterInvalidation);
  });

  it('a batch entry shares its cache entry with the singular read of the same call', async () => {
    const mocked = mockPublicClient();
    const queryClient = new QueryClient();

    mocked.values.set(`getTokenConfig:${TOKEN_A}`, 1n);
    const fromBatch = entryOptions(mocked, { functionName: 'getTokenConfig', args: [TOKEN_A] }, { staleTime: 60_000 });
    const batch = observe(queryClient, fromBatch);
    cleanups.push(batch.unsubscribe);
    await waitForData(batch.observer, 1n);

    // A singular useCofheReadContract of the same read builds the identical
    // options — subscribing to it dedupes onto the cached entry: same data,
    // no second fetch.
    const singular = observe(
      queryClient,
      entryOptions(mocked, { functionName: 'getTokenConfig', args: [TOKEN_A] }, { staleTime: 60_000 })
    );
    cleanups.push(singular.unsubscribe);

    expect(singular.observer.getCurrentResult().data).toEqual(1n);
    expect(mocked.readContract).toHaveBeenCalledTimes(1);
  });
});
