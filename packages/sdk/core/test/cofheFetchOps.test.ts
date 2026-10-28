import { describe, it, expect, vi, afterEach } from 'vitest';
import { setCofheDebugInterceptors } from '../debug.js';
import { tnDecryptV2 } from '../decrypt/tnDecryptV2.js';
import { tnSealOutputV2 } from '../decrypt/tnSealOutputV2.js';

const thresholdNetworkUrl = 'http://threshold.local';

const jsonResponse = (body: unknown) =>
  ({ ok: true, status: 200, statusText: '', json: async () => body }) as unknown as Response;

// Records the op an interceptor sees for each request.
const recordOps = () => {
  const ops: string[] = [];
  setCofheDebugInterceptors({ onRequest: (_url, _init, ctx) => void ops.push(ctx.op) });
  return ops;
};

describe('the op a debug interceptor sees', () => {
  afterEach(() => {
    setCofheDebugInterceptors(null);
    vi.restoreAllMocks();
  });

  it('names the decrypt submit and poll requests', async () => {
    const ops = recordOps();
    global.fetch = vi.fn(async (url: string) =>
      url.endsWith('/v2/decrypt')
        ? jsonResponse({ request_id: 'req-1' })
        : jsonResponse({
            request_id: 'req-1',
            status: 'COMPLETED',
            submitted_at: 't',
            is_succeed: true,
            decrypted: [0x01],
            signature: `0x${'01'.repeat(32)}${'02'.repeat(32)}1b`,
          })
    ) as any;

    await tnDecryptV2({ ctHash: 1n, chainId: 1, acp: null, thresholdNetworkUrl });

    expect(ops).toEqual(['decrypt', 'decrypt-poll']);
  });

  it('names the sealoutput submit and poll requests', async () => {
    const ops = recordOps();
    global.fetch = vi.fn(async (url: string) =>
      url.endsWith('/v2/sealoutput')
        ? jsonResponse({ request_id: 'req-1' })
        : jsonResponse({
            request_id: 'req-1',
            status: 'COMPLETED',
            submitted_at: 't',
            is_succeed: true,
            sealed: { data: [1], public_key: [2], nonce: [3] },
          })
    ) as any;

    await tnSealOutputV2({ ctHash: 1n, chainId: 1, acp: {} as any, thresholdNetworkUrl });

    expect(ops).toEqual(['sealoutput', 'sealoutput-poll']);
  });
});
