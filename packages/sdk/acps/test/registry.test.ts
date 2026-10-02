import { describe, expect, it, vi } from 'vitest';
import type { PublicClient } from 'viem';
import {
  readPostedShares,
  readShare,
  readSharesFor,
  shareIdOfChainShare,
  type ChainShare,
  type ShareHead,
} from '../registry';

const REGISTRY = '0x00000000000000000000000000000000000000e0';
const ISSUER = '0x00000000000000000000000000000000000000b0';
const RECIPIENT = '0x00000000000000000000000000000000000000a1';
const ZERO = '0x0000000000000000000000000000000000000000';

const chainShare = (handle: number): ChainShare => ({
  issuer: ISSUER,
  expiration: 2_000_000_000n,
  recipient: RECIPIENT,
  revokerData: 0n,
  revokerContract: ZERO,
  scope: 2,
  contracts: [],
  handles: [`0x${handle.toString(16).padStart(64, '0')}`],
  sealingKey: `0x${'0'.repeat(64)}`,
  issuerSignature: '0x11',
  recipientSignature: '0x',
});

const headAt = (blockNumber: bigint): ShareHead => ({
  issuer: ISSUER,
  expiration: 2_000_000_000n,
  recipient: RECIPIENT,
  blockNumber,
  revokerContract: ZERO,
  revokerData: 0n,
});

/** Three shares: two posted in block 10, one in block 20. */
const shares = [chainShare(1), chainShare(2), chainShare(3)];
const ids = shares.map(shareIdOfChainShare);
const heads = [headAt(10n), headAt(10n), headAt(20n)];
const metadata = ['0x03aa', '0x', '0x03bb'] as const;

const clientWith = (
  events = shares.map((acp, i) => ({ block: heads[i].blockNumber, acp, id: ids[i], metadata: metadata[i] }))
) => {
  const getContractEvents = vi.fn(async ({ fromBlock, args }: { fromBlock: bigint; args: { shareId: string[] } }) =>
    events
      .filter((e) => e.block === fromBlock && args.shareId.includes(e.id))
      .map((e) => ({ args: { shareId: e.id, acp: e.acp, metadata: e.metadata } }))
  );
  const readContract = vi.fn(async ({ functionName, args }: { functionName: string; args: [string] }) => {
    if (functionName === 'sharesFor') return [ids, heads];
    const i = ids.indexOf(args[0] as `0x${string}`);
    return i === -1 ? { ...headAt(0n), issuer: ZERO } : heads[i];
  });
  return { client: { getContractEvents, readContract } as unknown as PublicClient, getContractEvents };
};

describe('registry reads', () => {
  it('reads the inbox with one getLogs per distinct block, in sharesFor order', async () => {
    const { client, getContractEvents } = clientWith();
    const posted = await readSharesFor(client, REGISTRY, RECIPIENT);

    expect(posted.map((p) => p.shareId)).toEqual(ids);
    expect(posted.map((p) => p.share)).toEqual(shares);
    expect(posted.map((p) => p.metadata)).toEqual([...metadata]);
    expect(getContractEvents).toHaveBeenCalledTimes(2);
    expect(getContractEvents).toHaveBeenCalledWith(
      expect.objectContaining({
        eventName: 'Shared',
        fromBlock: 10n,
        toBlock: 10n,
        args: { shareId: [ids[0], ids[1]] },
      })
    );
  });

  it('reads one share, and null for an unknown one', async () => {
    const { client } = clientWith();
    expect((await readShare(client, REGISTRY, ids[2]))?.metadata).toBe('0x03bb');
    expect(await readShare(client, REGISTRY, `0x${'f'.repeat(64)}`)).toBeNull();
  });

  it('throws when the block the head names has no Shared event of the share', async () => {
    const { client } = clientWith([]);
    await expect(readPostedShares(client, REGISTRY, [{ shareId: ids[0], head: heads[0] }])).rejects.toThrow(
      'no Shared event in block 10'
    );
  });

  it('throws when an event payload does not hash to its share id', async () => {
    const { client } = clientWith([{ block: 10n, acp: shares[1], id: ids[0], metadata: '0x' }]);
    await expect(readPostedShares(client, REGISTRY, [{ shareId: ids[0], head: heads[0] }])).rejects.toThrow(
      'does not hash to its id'
    );
  });
});
