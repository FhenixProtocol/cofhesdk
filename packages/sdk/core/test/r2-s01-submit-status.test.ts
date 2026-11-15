import { describe, it, expect, vi, afterEach } from 'vitest';
import { ACPUtils } from '../../acps/acp.js';
import { seal } from '../../acps/sealing.js';
import { tnSealOutputV2 } from '../decrypt/tnSealOutputV2.js';
import { tnDecryptV2 } from '../decrypt/tnDecryptV2.js';

const issuer = '0x1234567890123456789012345678901234567890';
const TN = 'http://tn.local';

// A well-formed 65-byte signature viem accepts: r=0x1111.., s=0x2222.., v=27.
const GOOD_SIG = ('0x' + '11'.repeat(32) + '22'.repeat(32) + '1b') as `0x${string}`;

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

describe('submit parsers reject a FAILED status', () => {
  it('tnDecryptV2 rejects a 200 whose status is FAILED even with decrypted bytes', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => jsonResp({ request_id: 'r1', status: 'FAILED', decrypted: [42], signature: GOOD_SIG }))
    );
    await expect(
      tnDecryptV2({ ctHash: 123n, chainId: 1, acp: null, thresholdNetworkUrl: TN })
    ).rejects.toThrow(/failed/i);
  });

  it('tnSealOutputV2 rejects a 200 whose status is FAILED even with sealed bytes', async () => {
    const acp = ACPUtils.createSelf({ issuer });
    const sealed = seal(42n, acp.sealingKey);
    vi.stubGlobal(
      'fetch',
      vi.fn(async () =>
        jsonResp({
          request_id: 'r1',
          status: 'FAILED',
          sealed: { data: [...sealed.data], public_key: [...sealed.public_key], nonce: [...sealed.nonce] },
        })
      )
    );
    await expect(
      tnSealOutputV2({ ctHash: 123n, chainId: 1, acp: ACPUtils.getPublic(acp, true), thresholdNetworkUrl: TN })
    ).rejects.toThrow(/failed/i);
  });

  it('tnDecryptV2 still accepts a 200 with no status and a valid result', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => jsonResp({ request_id: 'r1', decrypted: [42], signature: GOOD_SIG }))
    );
    await expect(
      tnDecryptV2({ ctHash: 123n, chainId: 1, acp: null, thresholdNetworkUrl: TN })
    ).resolves.toMatchObject({ decryptedValue: 42n });
  });
});
