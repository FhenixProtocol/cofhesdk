/**
 * Unit tests for the zero-sentinel receipt normalizer. Scripted client by
 * necessity: Anvil never emits zero-sentinel block hashes, so the degenerate
 * paths under test cannot be produced against a real node.
 */
import { describe, expect, it } from 'vitest';
import type { PublicClient, TransactionReceipt } from 'viem';
import { resolveReceiptBlockHash } from './resolveReceiptBlockHash';

const ZERO_HASH = '0x0000000000000000000000000000000000000000000000000000000000000000' as const;
const REAL_HASH = '0x2222222222222222222222222222222222222222222222222222222222222222' as const;
const TX_HASH = '0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa' as const;

function receiptWith(blockHash: `0x${string}`): TransactionReceipt {
  return {
    transactionHash: TX_HASH,
    blockHash,
    blockNumber: 5n,
    status: 'success',
  } as TransactionReceipt;
}

function scriptedClient(answers: () => TransactionReceipt | Error) {
  let fetches = 0;
  const client = {
    getTransactionReceipt: async ({ hash }: { hash: `0x${string}` }) => {
      expect(hash).toBe(TX_HASH); // resolved by TX HASH, never by block height (reorg-safe)
      fetches += 1;
      const answer = answers();
      if (answer instanceof Error) throw answer;
      return answer;
    },
  } as unknown as PublicClient;
  return { client, fetchCount: () => fetches };
}

const FAST = { pollingIntervalMs: 2, maxWaitMs: 40 } as const;

describe('resolveReceiptBlockHash', () => {
  it('passes a receipt with a real hash through untouched — zero RPC calls', async () => {
    const { client, fetchCount } = scriptedClient(() => receiptWith(REAL_HASH));
    const receipt = receiptWith(REAL_HASH);
    expect(await resolveReceiptBlockHash(receipt, client, FAST)).toBe(receipt);
    expect(fetchCount()).toBe(0);
  });

  it('re-fetches a zero-sentinel receipt by tx hash until it carries a real hash', async () => {
    let round = 0;
    const { client, fetchCount } = scriptedClient(() => receiptWith(++round >= 2 ? REAL_HASH : ZERO_HASH));
    const resolved = await resolveReceiptBlockHash(receiptWith(ZERO_HASH), client, FAST);
    expect(resolved.blockHash).toBe(REAL_HASH);
    expect(fetchCount()).toBe(2);
  });

  it('is BOUNDED: throws after maxWaitMs instead of polling forever', async () => {
    const { client, fetchCount } = scriptedClient(() => receiptWith(ZERO_HASH));
    await expect(resolveReceiptBlockHash(receiptWith(ZERO_HASH), client, FAST)).rejects.toThrow(/gave up after/);
    expect(fetchCount()).toBeGreaterThanOrEqual(2);
    expect(fetchCount()).toBeLessThan(50);
  });

  it('keeps retrying through transient fetch errors (still bounded)', async () => {
    let round = 0;
    const { client } = scriptedClient(() => (++round >= 2 ? receiptWith(REAL_HASH) : new Error('rpc hiccup')));
    const resolved = await resolveReceiptBlockHash(receiptWith(ZERO_HASH), client, FAST);
    expect(resolved.blockHash).toBe(REAL_HASH);
  });

  it('aborts promptly via the signal', async () => {
    const { client } = scriptedClient(() => receiptWith(ZERO_HASH));
    const controller = new AbortController();
    setTimeout(() => controller.abort(), 5);
    await expect(
      resolveReceiptBlockHash(receiptWith(ZERO_HASH), client, {
        pollingIntervalMs: 2,
        maxWaitMs: 10_000,
        signal: controller.signal,
      })
    ).rejects.toMatchObject({ name: 'AbortError' });
  });
});
