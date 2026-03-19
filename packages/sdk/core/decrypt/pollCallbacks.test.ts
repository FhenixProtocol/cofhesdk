import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { tnDecryptV2 } from './tnDecryptV2.js';
import { tnSealOutputV2 } from './tnSealOutputV2.js';

const makeMockResponse = (opts: { ok: boolean; status?: number; statusText?: string; json: () => Promise<any> }) => {
  return {
    ok: opts.ok,
    status: opts.status ?? (opts.ok ? 200 : 500),
    statusText: opts.statusText ?? '',
    json: opts.json,
  } as unknown as Response;
};

describe('decrypt polling callbacks', () => {
  const thresholdNetworkUrl = 'http://threshold.local';

  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it('tnDecryptV2 calls onPoll once per poll attempt', async () => {
    const onPoll = vi.fn();

    let decryptStatusCalls = 0;
    const fetchMock = vi.fn(async (url: string, options?: any) => {
      if (url === `${thresholdNetworkUrl}/v2/decrypt` && options?.method === 'POST') {
        return makeMockResponse({
          ok: true,
          json: async () => ({ request_id: 'req-1' }),
        });
      }

      if (url === `${thresholdNetworkUrl}/v2/decrypt/req-1` && options?.method === 'GET') {
        decryptStatusCalls += 1;

        if (decryptStatusCalls === 1) {
          return makeMockResponse({
            ok: true,
            json: async () => ({
              request_id: 'req-1',
              status: 'PROCESSING',
              submitted_at: 't',
            }),
          });
        }

        return makeMockResponse({
          ok: true,
          json: async () => ({
            request_id: 'req-1',
            status: 'COMPLETED',
            submitted_at: 't',
            is_succeed: true,
            decrypted: [0x01],
            signature: `0x${'01'.repeat(32)}${'02'.repeat(32)}1b`,
          }),
        });
      }

      throw new Error(`Unexpected fetch: ${url}`);
    });

    global.fetch = fetchMock as any;

    const promise = tnDecryptV2({
      ctHash: 1n,
      chainId: 1,
      permission: null,
      thresholdNetworkUrl,
      onPoll,
    });

    for (let i = 0; i < 25 && onPoll.mock.calls.length < 1; i += 1) {
      await Promise.resolve();
    }
    expect(onPoll).toHaveBeenCalledTimes(1);

    await vi.advanceTimersByTimeAsync(1000);
    const result = await promise;

    expect(result.decryptedValue).toBe(1n);
    expect(result.signature.startsWith('0x')).toBe(true);

    expect(onPoll).toHaveBeenCalledTimes(2);
    expect(onPoll).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({
        operation: 'decrypt',
        requestId: 'req-1',
        attemptIndex: 0,
        intervalMs: 1000,
        timeoutMs: 5 * 60 * 1000,
      })
    );
    expect(onPoll).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({
        operation: 'decrypt',
        requestId: 'req-1',
        attemptIndex: 1,
      })
    );
  });

  it('tnSealOutputV2 calls onPoll once per poll attempt', async () => {
    const onPoll = vi.fn();

    let sealStatusCalls = 0;
    const fetchMock = vi.fn(async (url: string, options?: any) => {
      if (url === `${thresholdNetworkUrl}/v2/sealoutput` && options?.method === 'POST') {
        return makeMockResponse({
          ok: true,
          json: async () => ({ request_id: 'req-2' }),
        });
      }

      if (url === `${thresholdNetworkUrl}/v2/sealoutput/req-2` && options?.method === 'GET') {
        sealStatusCalls += 1;

        if (sealStatusCalls === 1) {
          return makeMockResponse({
            ok: true,
            json: async () => ({
              request_id: 'req-2',
              status: 'PROCESSING',
              submitted_at: 't',
            }),
          });
        }

        return makeMockResponse({
          ok: true,
          json: async () => ({
            request_id: 'req-2',
            status: 'COMPLETED',
            submitted_at: 't',
            is_succeed: true,
            sealed: {
              data: [1, 2, 3],
              public_key: [4, 5],
              nonce: [6],
            },
          }),
        });
      }

      throw new Error(`Unexpected fetch: ${url}`);
    });

    global.fetch = fetchMock as any;

    const promise = tnSealOutputV2({
      ctHash: 1n,
      chainId: 1,
      permission: {} as any,
      thresholdNetworkUrl,
      onPoll,
    });

    for (let i = 0; i < 25 && onPoll.mock.calls.length < 1; i += 1) {
      await Promise.resolve();
    }
    expect(onPoll).toHaveBeenCalledTimes(1);

    await vi.advanceTimersByTimeAsync(1000);
    const sealed = await promise;

    expect(sealed.data).toBeInstanceOf(Uint8Array);
    expect(Array.from(sealed.data)).toEqual([1, 2, 3]);

    expect(onPoll).toHaveBeenCalledTimes(2);
    expect(onPoll).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({
        operation: 'sealoutput',
        requestId: 'req-2',
        attemptIndex: 0,
      })
    );
    expect(onPoll).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({
        operation: 'sealoutput',
        requestId: 'req-2',
        attemptIndex: 1,
      })
    );
  });
});
