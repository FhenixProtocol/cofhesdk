import { describe, expect, it, vi } from 'vitest';
import { concatHex, padHex, type Hex, type Log, type PublicClient } from 'viem';
import { verifyShareLabel, verifyShareLabels } from '../verify';
import type { ShareLabel } from '../schema';
import { BALANCE_OF, CONFIDENTIAL_TRANSFER, CONFIDENTIAL_TRANSFER_TOPIC0, FUSD, FUSDY, ISSUER } from './fixtures';

const AMOUNT = `0x${'11'.repeat(32)}` as Hex;
const BALANCE = `0x${'22'.repeat(32)}` as Hex;
const OTHER = `0x${'33'.repeat(32)}` as Hex;
const ALICE = padHex('0xa11ce', { size: 32 });

const transferLog = (overrides: Partial<Log> = {}): Log =>
  ({
    address: FUSD,
    blockNumber: 100n,
    transactionIndex: 3,
    logIndex: 9,
    topics: [CONFIDENTIAL_TRANSFER_TOPIC0, ALICE, ALICE, AMOUNT],
    data: '0x',
    ...overrides,
  }) as Log;

const eventLabel = (overrides: Partial<ShareLabel & { kind: 'event' }> = {}): ShareLabel => ({
  kind: 'event',
  contract: FUSD,
  block: 100n,
  txIndex: 3,
  logIndex: 9,
  selector: CONFIDENTIAL_TRANSFER,
  ...overrides,
});

const balanceLabel: ShareLabel = {
  kind: 'stored',
  contract: FUSDY,
  selector: BALANCE_OF,
  args: [{ type: 'issuer' }],
  returnWord: 0,
  block: 90n,
};

const clientWith = ({ logs = [transferLog()], callResult = BALANCE }: { logs?: Log[]; callResult?: Hex } = {}) => {
  const getLogs = vi.fn(async () => logs);
  const call = vi.fn(async () => ({ data: callResult }));
  return { client: { getLogs, call } as unknown as PublicClient, getLogs, call };
};

describe('verifyShareLabel', () => {
  it('verifies an event value at its log index', async () => {
    const { client, getLogs } = clientWith();
    expect(await verifyShareLabel(eventLabel(), AMOUNT, client, ISSUER)).toBe('verified');
    expect(getLogs).toHaveBeenCalledWith({ address: FUSD, fromBlock: 100n, toBlock: 100n });
  });

  it('finds the ctHash among the data words too', async () => {
    const { client } = clientWith({
      logs: [transferLog({ topics: [CONFIDENTIAL_TRANSFER_TOPIC0], data: concatHex([OTHER, AMOUNT]) })],
    });
    expect(await verifyShareLabel(eventLabel(), AMOUNT, client, ISSUER)).toBe('verified');
  });

  it.each([
    ['another log index', eventLabel({ logIndex: 8 })],
    ['another transaction', eventLabel({ txIndex: 4 })],
    ['another event selector', eventLabel({ selector: '0xddf252ad' })],
  ])('rejects an event value naming %s', async (_, label) => {
    const { client } = clientWith();
    expect(await verifyShareLabel(label, AMOUNT, client, ISSUER)).toBe('mismatch');
  });

  it('rejects an event value whose log does not carry the ctHash', async () => {
    const { client } = clientWith();
    expect(await verifyShareLabel(eventLabel(), OTHER, client, ISSUER)).toBe('mismatch');
  });

  it('verifies a stored value by repeating the call with the issuer at the labelled block', async () => {
    const { client, call } = clientWith();
    expect(await verifyShareLabel(balanceLabel, BALANCE, client, ISSUER)).toBe('verified');
    expect(call).toHaveBeenCalledWith({
      to: FUSDY,
      data: concatHex([BALANCE_OF, padHex(ISSUER, { size: 32 })]),
      blockNumber: 90n,
    });
  });

  it('rejects a stored value the call does not return', async () => {
    const { client } = clientWith({ callResult: OTHER });
    expect(await verifyShareLabel(balanceLabel, BALANCE, client, ISSUER)).toBe('mismatch');
  });

  it('reports a failed request, and an unlabelled value, as unverifiable', async () => {
    const client = { call: vi.fn().mockRejectedValue(new Error('missing trie node')) } as unknown as PublicClient;
    expect(await verifyShareLabel(balanceLabel, BALANCE, client, ISSUER)).toBe('unverifiable');
    expect(await verifyShareLabel({ kind: 'unlabelled' }, BALANCE, client, ISSUER)).toBe('unverifiable');
  });
});

describe('verifyShareLabels', () => {
  const labels: ShareLabel[] = [balanceLabel, eventLabel(), eventLabel({ logIndex: 10 }), { kind: 'unlabelled' }];
  const handles = [BALANCE, AMOUNT, OTHER, OTHER];
  const logs = [
    transferLog(),
    transferLog({ logIndex: 10, topics: [CONFIDENTIAL_TRANSFER_TOPIC0, ALICE, ALICE, OTHER] }),
  ];

  it("checks everything with 'all', one getLogs per contract and block", async () => {
    const { client, getLogs, call } = clientWith({ logs });
    expect(await verifyShareLabels({ labels, handles, issuer: ISSUER, publicClient: client })).toEqual([
      'verified',
      'verified',
      'verified',
      'unverifiable',
    ]);
    expect(getLogs).toHaveBeenCalledTimes(1);
    expect(call).toHaveBeenCalledTimes(1);
  });

  it("skips stored values with 'events'", async () => {
    const { client, call } = clientWith({ logs });
    expect(
      await verifyShareLabels({ labels, handles, issuer: ISSUER, publicClient: client, verify: 'events' })
    ).toEqual(['skipped', 'verified', 'verified', 'unverifiable']);
    expect(call).not.toHaveBeenCalled();
  });

  it("makes no request with 'none'", async () => {
    const { client, call, getLogs } = clientWith({ logs });
    expect(await verifyShareLabels({ labels, handles, issuer: ISSUER, publicClient: client, verify: 'none' })).toEqual([
      'skipped',
      'skipped',
      'skipped',
      'skipped',
    ]);
    expect(call).not.toHaveBeenCalled();
    expect(getLogs).not.toHaveBeenCalled();
  });

  it('refuses labels that do not match the handles one for one', async () => {
    const { client } = clientWith();
    await expect(
      verifyShareLabels({ labels, handles: [BALANCE], issuer: ISSUER, publicClient: client })
    ).rejects.toThrow('4 labels for 1 ctHashes');
  });
});
