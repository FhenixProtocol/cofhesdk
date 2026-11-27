import { describe, it, expect, vi, afterEach } from 'vitest';
import { encodeFunctionResult } from 'viem';
import { cofheMocksZkVerifySign } from '../encrypt/cofheMocksZkVerifySign.js';
import { MockZkVerifierAbi } from '../encrypt/MockZkVerifierAbi.js';
import { Encryptable } from '../types.js';
import { fakeMocksNode } from './fakeMocksNode.js';

afterEach(() => vi.unstubAllGlobals());

describe('cofheMocksZkVerifySign', () => {
  it('reads and sends insertPackedCtHashes through the mocks request function', async () => {
    const fetchMock = vi.fn(async () => {
      throw new Error('connection refused');
    });
    vi.stubGlobal('fetch', fetchMock);

    const node = fakeMocksNode(() =>
      encodeFunctionResult({ abi: MockZkVerifierAbi, functionName: 'zkVerifyCalcCtHashesPacked', result: [123n] })
    );

    const result = await cofheMocksZkVerifySign(
      [Encryptable.uint8(1n)],
      '0x00000000000000000000000000000000000000aa',
      0,
      '0x00000000000000000000000000000000000000bb',
      node.request
    );

    expect(result.outputs).toHaveLength(1);
    expect(node.methods).toContain('eth_call');
    expect(node.methods).toContain('eth_sendRawTransaction');
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
