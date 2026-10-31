import { describe, it, expect, vi, afterEach } from 'vitest';
import { type PublicClient } from 'viem';
import { hardhat } from 'viem/chains';
import { cofheMocksZkVerifySign } from '../encrypt/cofheMocksZkVerifySign.js';
import { Encryptable } from '../types.js';

afterEach(() => vi.unstubAllGlobals());

describe('cofheMocksZkVerifySign without a zkvWalletClient', () => {
  it('sends insertPackedCtHashes through the public client node', async () => {
    const fetchMock = vi.fn(async () => {
      throw new Error('connection refused');
    });
    vi.stubGlobal('fetch', fetchMock);

    const methods: string[] = [];
    const request = vi.fn(async ({ method }: { method: string }) => {
      methods.push(method);
      switch (method) {
        case 'eth_chainId':
          return `0x${hardhat.id.toString(16)}`;
        case 'eth_getTransactionCount':
        case 'eth_maxPriorityFeePerGas':
          return '0x0';
        case 'eth_estimateGas':
          return '0x5208';
        case 'eth_gasPrice':
          return '0x1';
        case 'eth_getBlockByNumber':
          return { baseFeePerGas: '0x1', number: '0x1', hash: `0x${'00'.repeat(32)}` };
        case 'eth_sendRawTransaction':
          return `0x${'11'.repeat(32)}`;
        default:
          throw new Error(`unexpected ${method}`);
      }
    });
    const publicClient = {
      readContract: vi.fn(async () => [123n]),
      request,
    } as unknown as PublicClient;

    const result = await cofheMocksZkVerifySign(
      [Encryptable.uint8(1n)],
      '0x00000000000000000000000000000000000000aa',
      0,
      '0x00000000000000000000000000000000000000bb',
      publicClient,
      {} as any,
      undefined
    );

    expect(result.outputs).toHaveLength(1);
    expect(methods).toContain('eth_sendRawTransaction');
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
