import { describe, expect, it, vi } from 'vitest';
import { createWalletClient, custom, keccak256, parseAbi, type Hex } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { removeConfirmedShare } from '../src/suites/shareRemoval';

const registry = '0x0000000000000000000000000000000000000011';
const shareId = `0x${'12'.repeat(32)}` as Hex;
const abi = parseAbi(['function removeShare(bytes32 shareId)']);

function fixture(failures: number, selector = '0x3d03aecf', decoded = false) {
  let estimates = 0;
  const sent: Hex[] = [];
  const account = privateKeyToAccount(`0x${'01'.padStart(64, '0')}`);
  const client = createWalletClient({
    account,
    transport: custom(
      {
        request: async ({ method, params }) => {
          if (method === 'eth_chainId') return '0xaa36a7';
          if (method === 'eth_estimateGas') {
            if (estimates++ < failures)
              throw Object.assign(new Error('execution reverted'), { code: 3, data: selector });
            return '0x186a0';
          }
          if (method === 'eth_sendRawTransaction') {
            const raw = (params as [Hex])[0];
            sent.push(raw);
            return keccak256(raw);
          }
          throw new Error(`Unexpected RPC method ${method}`);
        },
      },
      { retryCount: 0 }
    ),
  });
  const remove = vi.fn(() =>
    client.writeContract({
      address: registry,
      abi: decoded ? parseAbi(['function removeShare(bytes32 shareId)', 'error UnknownShare()']) : abi,
      functionName: 'removeShare',
      args: [shareId],
      chain: null,
      type: 'legacy',
      nonce: 0,
      gasPrice: 1n,
    })
  );
  const waits: number[] = [];
  const wait = async (ms: number) => {
    waits.push(ms);
  };
  return { remove, wait, sent, waits, estimates: () => estimates };
}

describe('removing a confirmed share through a lagging RPC', () => {
  it.each([false, true])(
    'retries only UnknownShare estimates and submits exactly once (decoded ABI: %s)',
    async (decoded) => {
      const f = fixture(2, undefined, decoded);
      const hash = await removeConfirmedShare(f.remove, f.wait);
      expect(f.estimates()).toBe(3);
      expect(f.waits).toEqual([5_000, 5_000]);
      expect(f.sent).toHaveLength(1);
      expect(hash).toBe(keccak256(f.sent[0]));
    }
  );

  it('preserves a persistent UnknownShare failure after the bounded retries without broadcasting', async () => {
    const f = fixture(Infinity);
    await expect(removeConfirmedShare(f.remove, f.wait)).rejects.toThrow(/removeShare/);
    expect(f.estimates()).toBe(7);
    expect(f.waits).toHaveLength(6);
    expect(f.sent).toHaveLength(0);
  });

  it('immediately rejects another contract error without retrying or broadcasting', async () => {
    const f = fixture(Infinity, '0x5f3677bc'); // NotIssuerOrRecipient()
    await expect(removeConfirmedShare(f.remove, f.wait)).rejects.toThrow(/removeShare/);
    expect(f.estimates()).toBe(1);
    expect(f.waits).toHaveLength(0);
    expect(f.sent).toHaveLength(0);
  });

  it('immediately propagates a transport failure instead of retrying an ambiguous write', async () => {
    const error = new Error('connection closed before response');
    const remove = vi.fn().mockRejectedValue(error);
    const wait = vi.fn();
    await expect(removeConfirmedShare(remove, wait)).rejects.toBe(error);
    expect(remove).toHaveBeenCalledTimes(1);
    expect(wait).not.toHaveBeenCalled();
  });
});
