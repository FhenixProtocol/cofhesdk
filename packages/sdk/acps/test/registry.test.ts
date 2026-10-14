import { describe, expect, it, vi } from 'vitest';
import type { PublicClient } from 'viem';
import {
  readPostedShares,
  readShare,
  readSharesFor,
  shareIdOfChainShare,
  type ChainShare,
  type ShareHeader,
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

const headerAt = (blockNumber: bigint): ShareHeader => ({
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
const headers = [headerAt(10n), headerAt(10n), headerAt(20n)];
const metadata: `0x${string}`[] = ['0x03aa', '0x', '0x03bb'];

const clientWith = (
  events = shares.map((acp, i) => ({ block: headers[i].blockNumber, acp, id: ids[i], metadata: metadata[i] }))
) => {
  const getContractEvents = vi.fn(async ({ fromBlock, args }: { fromBlock: bigint; args: { shareId: string[] } }) =>
    events
      .filter((e) => e.block === fromBlock && args.shareId.includes(e.id))
      .map((e) => ({ args: { shareId: e.id, acp: e.acp, metadata: e.metadata } }))
  );
  const readContract = vi.fn(async ({ functionName, args }: { functionName: string; args: [string] }) => {
    if (functionName === 'sharesFor') return [ids, headers];
    const i = ids.indexOf(args[0] as `0x${string}`);
    return i === -1 ? { ...headerAt(0n), issuer: ZERO } : headers[i];
  });
  return { client: { getContractEvents, readContract } as unknown as PublicClient, getContractEvents };
};

describe('registry reads', () => {
  it('reads the inbox with one getLogs per distinct block, in sharesFor order', async () => {
    const { client, getContractEvents } = clientWith();
    const { posted, unreadable } = await readSharesFor(client, REGISTRY, RECIPIENT);

    expect(unreadable).toEqual([]);
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

  it('takes the last Shared event when a share was removed and posted again in the same block', async () => {
    const { client } = clientWith([
      { block: 10n, acp: shares[0], id: ids[0], metadata: '0x03aa' },
      { block: 10n, acp: shares[0], id: ids[0], metadata: '0x03cc' },
    ]);
    const {
      posted: [posted],
    } = await readPostedShares(client, REGISTRY, [{ shareId: ids[0], header: headers[0] }]);
    expect(posted.metadata).toBe('0x03cc');
  });

  describe('one share never hides the rest', () => {
    const all = () => shares.map((_, i) => ({ shareId: ids[i], header: headers[i] }));

    it('a share whose block has no Shared event of it is unreadable, the others are posted', async () => {
      // the node answered sharesFor from a newer block than the one it serves logs for
      const { client } = clientWith(
        shares.slice(0, 2).map((acp, i) => ({ block: headers[i].blockNumber, acp, id: ids[i], metadata: metadata[i] }))
      );
      const { posted, unreadable } = await readPostedShares(client, REGISTRY, all());
      expect(posted.map((p) => p.shareId)).toEqual([ids[0], ids[1]]);
      expect(unreadable).toEqual([
        { shareId: ids[2], header: headers[2], reason: 'no Shared event in block 20, where the registry points' },
      ]);
    });

    it('a share whose event payload does not hash to its id is unreadable, the others are posted', async () => {
      const { client } = clientWith([
        { block: 10n, acp: shares[1], id: ids[0], metadata: '0x' }, // the payload of share 2 under the id of share 1
        { block: 10n, acp: shares[1], id: ids[1], metadata: '0x' },
        { block: 20n, acp: shares[2], id: ids[2], metadata: '0x03bb' },
      ]);
      const { posted, unreadable } = await readPostedShares(client, REGISTRY, all());
      expect(posted.map((p) => p.shareId)).toEqual([ids[1], ids[2]]);
      expect(unreadable.map((u) => [u.shareId, u.reason])).toEqual([
        [ids[0], 'the payload in its Shared event does not hash to its id'],
      ]);
    });

    it('a block the node cannot serve makes its shares unreadable, with the error, and the others are posted', async () => {
      const { client, getContractEvents } = clientWith();
      getContractEvents.mockImplementationOnce(async () => {
        throw new Error('block not found');
      });
      const { posted, unreadable } = await readPostedShares(client, REGISTRY, all());
      expect(posted.length + unreadable.length).toBe(3);
      expect(unreadable.length).toBeGreaterThan(0);
      for (const u of unreadable)
        expect(u.reason).toMatch(/Shared events of block \d+ could not be read: block not found/);
    });

    it('readShare throws, with the reason, for a listed share whose event cannot be read', async () => {
      const { client } = clientWith([]);
      await expect(readShare(client, REGISTRY, ids[0])).rejects.toThrow('no Shared event in block 10');
    });
  });
});
