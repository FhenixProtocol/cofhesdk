import { describe, expect, it, vi } from 'vitest';
import type { PublicClient } from 'viem';
import { acps } from '../acps';
import { UNLABELLED, encodeShareMetadata, shareAppKey } from '../../acps/share-metadata';
import { shareIdOfChainShare, type ChainShare, type ShareHeader } from '../../acps/registry';

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

const header: ShareHeader = {
  issuer: ISSUER,
  expiration: 2_000_000_000n,
  recipient: RECIPIENT,
  blockNumber: 10n,
  revokerContract: ZERO,
  revokerData: 0n,
};

const EXPLORER = shareAppKey('explorer.fhenix.io');
const WALLET = shareAppKey('wallet.example');

/** Three shares in one block: one for the explorer, one for a wallet app, one for no app. */
const shares = [chainShare(1), chainShare(2), chainShare(3)];
const ids = shares.map(shareIdOfChainShare);
const metadata = [
  encodeShareMetadata([UNLABELLED], { appKey: EXPLORER }),
  encodeShareMetadata([UNLABELLED], { appKey: WALLET }),
  '0x',
] as const;

const client = {
  readContract: vi.fn(async ({ functionName }: { functionName?: string } = {}) => {
    if (functionName === 'MAX_SHARES_PAGE') throw new Error('no pagination');
    return [ids, shares.map(() => header)];
  }),
  getContractEvents: vi.fn(async ({ args }: { args: { shareId: string[] } }) =>
    shares
      .map((acp, i) => ({ args: { shareId: ids[i], acp, metadata: metadata[i] } }))
      .filter((e) => args.shareId.includes(e.args.shareId))
  ),
} as unknown as PublicClient;

describe('getIncomingShares and the app key', () => {
  it('lists every share without an app, each with the key it carries', async () => {
    const incoming = await acps.getIncomingShares(client, REGISTRY, RECIPIENT);
    expect(incoming.map((s) => s.shareId)).toEqual(ids);
    expect(incoming.map((s) => s.appKey)).toEqual([EXPLORER, WALLET, undefined]);
  });

  it('lists only the shares posted for the app', async () => {
    const incoming = await acps.getIncomingShares(client, REGISTRY, RECIPIENT, { appKey: EXPLORER });
    expect(incoming.map((s) => s.shareId)).toEqual([ids[0]]);
  });

  it('leaves out a share whose event the node cannot serve yet, and keeps the rest', async () => {
    const lagging = {
      readContract: vi.fn(async ({ functionName }: { functionName?: string } = {}) => {
        if (functionName === 'MAX_SHARES_PAGE') throw new Error('no pagination');
        return [ids, shares.map(() => header)];
      }),
      getContractEvents: vi.fn(async ({ args }: { args: { shareId: string[] } }) =>
        shares
          .map((acp, i) => ({ args: { shareId: ids[i], acp, metadata: metadata[i] } }))
          .filter((e) => args.shareId.includes(e.args.shareId) && e.args.shareId !== ids[1])
      ),
    } as unknown as PublicClient;
    const incoming = await acps.getIncomingShares(lagging, REGISTRY, RECIPIENT);
    expect(incoming.map((s) => s.shareId)).toEqual([ids[0], ids[2]]);
  });

  it('lists nothing for an app no share names', async () => {
    expect(await acps.getIncomingShares(client, REGISTRY, RECIPIENT, { appKey: shareAppKey('other') })).toEqual([]);
  });
});
