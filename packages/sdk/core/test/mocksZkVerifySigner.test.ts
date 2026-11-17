import { describe, it, expect, vi, afterEach } from 'vitest';
import { type Hex, type PublicClient, parseTransaction } from 'viem';
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

  it('gives two concurrent encrypts of the same value their own ctHash', async () => {
    // A node like Hardhat or Anvil: the ctHash depends on the MockZkVerifier salt, each insert
    // advances the salt, and a transaction that reuses the verifier signer's nonce is rejected.
    let salt = 0n;
    let nonce = 0;
    const tick = () => new Promise((resolve) => setTimeout(resolve, 0));
    const request = vi.fn(async ({ method, params }: { method: string; params?: unknown[] }) => {
      await tick();
      switch (method) {
        case 'eth_chainId':
          return `0x${hardhat.id.toString(16)}`;
        case 'eth_getTransactionCount':
          return `0x${nonce.toString(16)}`;
        case 'eth_maxPriorityFeePerGas':
          return '0x0';
        case 'eth_estimateGas':
          return '0x5208';
        case 'eth_gasPrice':
          return '0x1';
        case 'eth_getBlockByNumber':
          return { baseFeePerGas: '0x1', number: '0x1', hash: `0x${'00'.repeat(32)}` };
        case 'eth_sendRawTransaction': {
          const tx = parseTransaction(params![0] as Hex);
          if (tx.nonce !== nonce) throw new Error(`Nonce too low. Expected nonce to be ${nonce} but got ${tx.nonce}.`);
          nonce += 1;
          salt += 1n;
          return `0x${'11'.repeat(32)}`;
        }
        default:
          throw new Error(`unexpected ${method}`);
      }
    });
    const publicClient = {
      readContract: vi.fn(async () => {
        await tick();
        return [1000n + salt];
      }),
      request,
    } as unknown as PublicClient;

    const encrypt = () =>
      cofheMocksZkVerifySign(
        [Encryptable.uint8(1n)],
        '0x00000000000000000000000000000000000000aa',
        0,
        '0x00000000000000000000000000000000000000bb',
        publicClient,
        {} as any,
        undefined
      );

    const results = await Promise.allSettled([encrypt(), encrypt()]);

    expect(results.map((r) => r.status)).toEqual(['fulfilled', 'fulfilled']);
    const [first, second] = results.map((r) => (r.status === 'fulfilled' ? r.value.outputs[0].ct_hash : undefined));
    expect(first).not.toEqual(second);
  });
});
