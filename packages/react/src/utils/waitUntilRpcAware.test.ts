/**
 * Unit tests for the wait-gate's failure modes. These use a SCRIPTED client by
 * necessity, not convenience: the cases under test — a node that never learns a
 * block (reorg / hopeless lag) and a read that fails while the block IS known —
 * cannot be produced on a single-node Anvil, which always knows its own blocks.
 * The happy paths (gating, batching, one-shot contexts) are covered against a
 * real chain in test/integration-matrix.
 */
import { describe, expect, it } from 'vitest';
import type { PublicClient } from 'viem';
import { maybeWaitUntilRpcAware } from './waitUntilRpcAwareAndReadContract';

const BLOCK_HASH = '0x1111111111111111111111111111111111111111111111111111111111111111' as const;

/** A publicClient whose eth_getBlockByHash answers from a script (null = unknown). */
function scriptedClient(blockAnswers: () => unknown) {
  let probes = 0;
  const client = {
    request: async ({ method }: { method: string }) => {
      if (method !== 'eth_getBlockByHash') throw new Error(`unexpected method ${method}`);
      probes += 1;
      return blockAnswers();
    },
  } as unknown as PublicClient;
  return { client, probeCount: () => probes };
}

const FAST = { pollingInterval: 2, maxWaitMs: 40 } as const;

describe('maybeWaitUntilRpcAware', () => {
  it('reads directly when no block hash is given — no probe at all', async () => {
    const { client, probeCount } = scriptedClient(() => null);
    const value = await maybeWaitUntilRpcAware(client, { read: async () => 7 }, FAST);
    expect(value).toBe(7);
    expect(probeCount()).toBe(0);
  });

  it('returns the read once the node knows the block', async () => {
    const { client, probeCount } = scriptedClient(() => ({ hash: BLOCK_HASH }));
    const value = await maybeWaitUntilRpcAware(
      client,
      { blockHashToBeAwareOf: BLOCK_HASH, read: async () => 42 },
      FAST
    );
    expect(value).toBe(42);
    expect(probeCount()).toBe(1);
  });

  it('keeps polling while the block is unknown, then returns', async () => {
    let round = 0;
    const { client, probeCount } = scriptedClient(() => (++round >= 3 ? { hash: BLOCK_HASH } : null));
    const value = await maybeWaitUntilRpcAware(
      client,
      { blockHashToBeAwareOf: BLOCK_HASH, read: async () => 'fresh' },
      FAST
    );
    expect(value).toBe('fresh');
    expect(probeCount()).toBe(3);
  });

  it('THROWS the read error when the block IS known — a real failure must not become a silent poll', async () => {
    const { client, probeCount } = scriptedClient(() => ({ hash: BLOCK_HASH }));
    const boom = new Error('execution reverted');
    await expect(
      maybeWaitUntilRpcAware(
        client,
        {
          blockHashToBeAwareOf: BLOCK_HASH,
          read: async () => {
            throw boom;
          },
        },
        FAST
      )
    ).rejects.toBe(boom);
    // Exactly one round: no retry loop for an error the gate cannot fix.
    expect(probeCount()).toBe(1);
  });

  it('gives up after maxWaitMs on a never-known block and serves the read un-gated', async () => {
    const { client, probeCount } = scriptedClient(() => null);
    const value = await maybeWaitUntilRpcAware(
      client,
      { blockHashToBeAwareOf: BLOCK_HASH, read: async () => 'possibly-stale' },
      FAST
    );
    expect(value).toBe('possibly-stale');
    // Bounded: it polled a few times, not forever.
    expect(probeCount()).toBeGreaterThanOrEqual(2);
    expect(probeCount()).toBeLessThan(50);
  });

  it('gives up after maxWaitMs and surfaces the read error when the un-gated read also fails', async () => {
    const { client } = scriptedClient(() => null);
    const boom = new Error('no contract at address');
    await expect(
      maybeWaitUntilRpcAware(
        client,
        {
          blockHashToBeAwareOf: BLOCK_HASH,
          read: async () => {
            throw boom;
          },
        },
        FAST
      )
    ).rejects.toBe(boom);
  });

  it('aborts promptly via the signal', async () => {
    const { client } = scriptedClient(() => null);
    const controller = new AbortController();
    setTimeout(() => controller.abort(), 5);
    await expect(
      maybeWaitUntilRpcAware(
        client,
        { blockHashToBeAwareOf: BLOCK_HASH, read: async () => 1 },
        { pollingInterval: 2, maxWaitMs: 10_000, signal: controller.signal }
      )
    ).rejects.toMatchObject({ name: 'AbortError' });
  });
});
