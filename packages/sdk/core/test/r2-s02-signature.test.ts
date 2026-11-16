import { describe, it, expect, vi, afterEach } from 'vitest';
import { tnDecryptV2 } from '../decrypt/tnDecryptV2.js';
import { CofheError } from '../error.js';

const TN = 'http://tn.local';

afterEach(() => {
  vi.unstubAllGlobals();
});

const jsonResp = (body: any, status = 200) =>
  ({
    ok: status >= 200 && status < 300,
    status,
    json: async () => body,
    text: async () => JSON.stringify(body),
  }) as unknown as Response;

describe('malformed TN signatures fail as CofheError', () => {
  it('a non-hex signature is a CofheError, not a raw viem error', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => jsonResp({ request_id: 'r1', decrypted: [42], signature: 'not-a-signature' }))
    );
    let caught: any;
    try {
      await tnDecryptV2({ ctHash: 123n, chainId: 1, acp: null, thresholdNetworkUrl: TN });
    } catch (e) {
      caught = e;
    }
    expect(caught).toBeInstanceOf(CofheError);
  });

  it('a truncated signature is a CofheError, not a raw viem error', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => jsonResp({ request_id: 'r1', decrypted: [42], signature: '0x1234' }))
    );
    let caught: any;
    try {
      await tnDecryptV2({ ctHash: 123n, chainId: 1, acp: null, thresholdNetworkUrl: TN });
    } catch (e) {
      caught = e;
    }
    expect(caught).toBeInstanceOf(CofheError);
  });

  it('a well-formed signature still normalizes', async () => {
    const goodSig = ('0x' + '11'.repeat(32) + '22'.repeat(32) + '1b') as `0x${string}`;
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => jsonResp({ request_id: 'r1', decrypted: [42], signature: goodSig }))
    );
    await expect(tnDecryptV2({ ctHash: 123n, chainId: 1, acp: null, thresholdNetworkUrl: TN })).resolves.toMatchObject({
      decryptedValue: 42n,
      signature: goodSig,
    });
  });
});
