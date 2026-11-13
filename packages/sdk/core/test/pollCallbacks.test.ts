import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { tnDecryptV2 } from '../decrypt/tnDecryptV2.js';
import { tnSealOutputV2 } from '../decrypt/tnSealOutputV2.js';
import { CofheErrorCode } from '../error.js';

const makeMockResponse = (opts: { ok: boolean; status?: number; statusText?: string; json: () => Promise<any> }) => {
  return {
    ok: opts.ok,
    status: opts.status ?? (opts.ok ? 200 : 500),
    statusText: opts.statusText ?? '',
    json: opts.json,
  } as unknown as Response;
};

describe('decrypt request retries and onPoll', () => {
  const thresholdNetworkUrl = 'http://threshold.local';

  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it('tnDecryptV2 fails when a 200 carries a request_id and no result, without asking a status endpoint', async () => {
    const onPoll = vi.fn();
    const fetchMock = vi.fn(async (url: string, options?: any) => {
      if (url === `${thresholdNetworkUrl}/v2/decrypt` && options?.method === 'POST') {
        return makeMockResponse({ ok: true, status: 200, json: async () => ({ request_id: 'req-1' }) });
      }

      throw new Error(`Unexpected fetch: ${url}`);
    });

    global.fetch = fetchMock as any;

    await expect(tnDecryptV2({ ctHash: 1n, chainId: 1, acp: null, thresholdNetworkUrl, onPoll })).rejects.toMatchObject(
      { code: CofheErrorCode.DecryptReturnedNull }
    );
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(onPoll).not.toHaveBeenCalled();
  });

  it('tnDecryptV2 calls onPoll for 204 submit retries', async () => {
    const onPoll = vi.fn();

    let submitCalls = 0;
    const fetchMock = vi.fn(async (url: string, options?: any) => {
      if (url === `${thresholdNetworkUrl}/v2/decrypt` && options?.method === 'POST') {
        submitCalls += 1;

        if (submitCalls === 1) {
          return makeMockResponse({
            ok: true,
            status: 204,
            json: async () => {
              throw new Error('json() should not be called for 204 submit responses');
            },
          });
        }

        return makeMockResponse({
          ok: true,
          status: 200,
          json: async () => ({
            request_id: 'req-submit-retry',
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
      acp: null,
      thresholdNetworkUrl,
      onPoll,
    });

    for (let i = 0; i < 25 && onPoll.mock.calls.length < 1; i += 1) {
      await Promise.resolve();
    }

    expect(onPoll).toHaveBeenCalledTimes(1);
    expect(onPoll).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({
        operation: 'decrypt',
        requestId: '',
        attemptIndex: 0,
        intervalMs: 1000,
        timeoutMs: 5 * 60 * 1000,
      })
    );

    await vi.advanceTimersByTimeAsync(1000);
    await promise;

    expect(onPoll).toHaveBeenCalledTimes(1);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('tnDecryptV2 fails on the first 404 ct_not_found without retrying', async () => {
    const onPoll = vi.fn();
    const fetchMock = vi.fn(async (url: string, options?: any) => {
      if (url === `${thresholdNetworkUrl}/v2/decrypt` && options?.method === 'POST') {
        return makeMockResponse({
          ok: false,
          status: 404,
          statusText: 'Not Found',
          json: async () => ({ error: 'ct_not_found' }),
        });
      }

      throw new Error(`Unexpected fetch: ${url}`);
    });

    global.fetch = fetchMock as any;

    await expect(
      tnDecryptV2({
        ctHash: 1n,
        chainId: 1,
        acp: null,
        thresholdNetworkUrl,
        onPoll,
      })
    ).rejects.toMatchObject({
      code: CofheErrorCode.CtNotFound,
      apiErrorCode: 'ct_not_found',
    });
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(onPoll).not.toHaveBeenCalled();
  });

  it('tnDecryptV2 does not retry a 401 acp_denied submit', async () => {
    const onPoll = vi.fn();
    const fetchMock = vi.fn(async (url: string, options?: any) => {
      if (url === `${thresholdNetworkUrl}/v2/decrypt` && options?.method === 'POST') {
        // The v2 error body carries the code only.
        return makeMockResponse({
          ok: false,
          status: 401,
          statusText: 'Unauthorized',
          json: async () => ({ error: 'acp_denied' }),
        });
      }

      throw new Error(`Unexpected fetch: ${url}`);
    });

    global.fetch = fetchMock as any;

    await expect(
      tnDecryptV2({
        ctHash: 1n,
        chainId: 1,
        acp: null,
        thresholdNetworkUrl,
        onPoll,
      })
    ).rejects.toMatchObject({ code: CofheErrorCode.ACPDenied, apiErrorCode: 'acp_denied' });
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(onPoll).not.toHaveBeenCalled();
  });

  it('tnDecryptV2 retries not_publicly_allowed inside the access-denied retry window, then returns the result', async () => {
    const onPoll = vi.fn();
    let calls = 0;
    const fetchMock = vi.fn(async (url: string, options?: any) => {
      if (url === `${thresholdNetworkUrl}/v2/decrypt` && options?.method === 'POST') {
        calls += 1;
        // The network has not seen the grant for the first two requests.
        if (calls <= 2) {
          return makeMockResponse({
            ok: false,
            status: 403,
            json: async () => ({ error: 'not_publicly_allowed' }),
          });
        }
        return makeMockResponse({
          ok: true,
          status: 200,
          json: async () => ({
            request_id: 'req-after-grant',
            decrypted: [0x00, 0x00, 0x00, 0x5c],
            signature: `${'01'.repeat(32)}${'02'.repeat(32)}1b`,
            encryption_type: 4,
          }),
        });
      }

      throw new Error(`Unexpected fetch: ${url}`);
    });

    global.fetch = fetchMock as any;

    const promise = tnDecryptV2({
      ctHash: 1n,
      chainId: 1,
      acp: null,
      thresholdNetworkUrl,
      onPoll,
      accessDeniedRetryTimeoutMs: 30_000,
    });

    await vi.advanceTimersByTimeAsync(2_000);
    const result = await promise;

    expect(result.decryptedValue).toBe(92n);
    expect(fetchMock).toHaveBeenCalledTimes(3);
    expect(onPoll).toHaveBeenCalledTimes(2);
    expect(onPoll).toHaveBeenCalledWith(expect.objectContaining({ requestId: '', attemptIndex: 0 }));
  });

  it('tnDecryptV2 fails with the denial once the access-denied retry window ends', async () => {
    const fetchMock = vi.fn(async (url: string, options?: any) => {
      if (url === `${thresholdNetworkUrl}/v2/decrypt` && options?.method === 'POST') {
        return makeMockResponse({
          ok: false,
          status: 403,
          json: async () => ({ error: 'not_publicly_allowed' }),
        });
      }

      throw new Error(`Unexpected fetch: ${url}`);
    });

    global.fetch = fetchMock as any;

    const promise = tnDecryptV2({
      ctHash: 1n,
      chainId: 1,
      acp: null,
      thresholdNetworkUrl,
      accessDeniedRetryTimeoutMs: 3_000,
    });
    const rejection = expect(promise).rejects.toMatchObject({
      code: CofheErrorCode.NotPubliclyAllowed,
      apiErrorCode: 'not_publicly_allowed',
    });

    await vi.advanceTimersByTimeAsync(5_000);
    await rejection;
    expect(fetchMock.mock.calls.length).toBeGreaterThan(1);
  });

  it('tnDecryptV2 returns immediately when submit answers 200 with the result', async () => {
    const onPoll = vi.fn();

    const fetchMock = vi.fn(async (url: string, options?: any) => {
      if (url === `${thresholdNetworkUrl}/v2/decrypt` && options?.method === 'POST') {
        return makeMockResponse({
          ok: true,
          status: 200,
          json: async () => ({
            request_id: 'req-cached',
            decrypted: [0x00, 0x00, 0x00, 0x5c],
            signature: `${'01'.repeat(32)}${'02'.repeat(32)}1b`,
            encryption_type: 4,
          }),
        });
      }

      throw new Error(`Unexpected fetch: ${url}`);
    });

    global.fetch = fetchMock as any;

    const result = await tnDecryptV2({
      ctHash: 1n,
      chainId: 1,
      acp: null,
      thresholdNetworkUrl,
      onPoll,
    });

    expect(result.decryptedValue).toBe(92n);
    expect(result.signature.startsWith('0x')).toBe(true);
    expect(onPoll).not.toHaveBeenCalled();
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('tnDecryptV2 gives up once the timeout budget is spent on 204 retries', async () => {
    const onPoll = vi.fn();
    const fetchMock = vi.fn(async (url: string, options?: any) => {
      if (url === `${thresholdNetworkUrl}/v2/decrypt` && options?.method === 'POST') {
        return makeMockResponse({
          ok: true,
          status: 204,
          json: async () => {
            throw new Error('json() should not be called for 204 submit responses');
          },
        });
      }

      throw new Error(`Unexpected fetch: ${url}`);
    });

    global.fetch = fetchMock as any;

    const promise = tnDecryptV2({ ctHash: 1n, chainId: 1, acp: null, thresholdNetworkUrl, onPoll });
    const rejection = expect(promise).rejects.toMatchObject({
      message: 'decrypt result was not ready after retrying for 300000ms',
    });

    await vi.advanceTimersByTimeAsync(310_000);

    await rejection;
    expect(onPoll).toHaveBeenLastCalledWith(
      expect.objectContaining({ operation: 'decrypt', requestId: '', timeoutMs: 5 * 60 * 1000 })
    );
  });

  it('tnSealOutputV2 fails when a 200 carries a request_id and no result, without asking a status endpoint', async () => {
    const onPoll = vi.fn();
    const fetchMock = vi.fn(async (url: string, options?: any) => {
      if (url === `${thresholdNetworkUrl}/v2/sealoutput` && options?.method === 'POST') {
        return makeMockResponse({ ok: true, status: 200, json: async () => ({ request_id: 'req-1' }) });
      }

      throw new Error(`Unexpected fetch: ${url}`);
    });

    global.fetch = fetchMock as any;

    await expect(
      tnSealOutputV2({ ctHash: 1n, chainId: 1, acp: {} as any, thresholdNetworkUrl, onPoll })
    ).rejects.toMatchObject({ code: CofheErrorCode.SealOutputReturnedNull });
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(onPoll).not.toHaveBeenCalled();
  });

  it('tnSealOutputV2 calls onPoll for 204 submit retries', async () => {
    const onPoll = vi.fn();

    let submitCalls = 0;
    const fetchMock = vi.fn(async (url: string, options?: any) => {
      if (url === `${thresholdNetworkUrl}/v2/sealoutput` && options?.method === 'POST') {
        submitCalls += 1;

        if (submitCalls === 1) {
          return makeMockResponse({
            ok: true,
            status: 204,
            json: async () => {
              throw new Error('json() should not be called for 204 submit responses');
            },
          });
        }

        return makeMockResponse({
          ok: true,
          status: 200,
          json: async () => ({
            request_id: 'req-seal-submit-retry',
            sealed_data: [1, 2, 3],
            ephemeral_public_key: [4, 5],
            nonce: [6],
          }),
        });
      }

      throw new Error(`Unexpected fetch: ${url}`);
    });

    global.fetch = fetchMock as any;

    const promise = tnSealOutputV2({
      ctHash: 1n,
      chainId: 1,
      acp: {} as any,
      thresholdNetworkUrl,
      onPoll,
    });

    for (let i = 0; i < 25 && onPoll.mock.calls.length < 1; i += 1) {
      await Promise.resolve();
    }

    expect(onPoll).toHaveBeenCalledTimes(1);
    expect(onPoll).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({
        operation: 'sealoutput',
        requestId: '',
        attemptIndex: 0,
        intervalMs: 1000,
        timeoutMs: 5 * 60 * 1000,
      })
    );

    await vi.advanceTimersByTimeAsync(1000);
    await promise;

    expect(onPoll).toHaveBeenCalledTimes(1);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('tnSealOutputV2 fails on the first 404 ct_not_found without retrying', async () => {
    const onPoll = vi.fn();
    const fetchMock = vi.fn(async (url: string, options?: any) => {
      if (url === `${thresholdNetworkUrl}/v2/sealoutput` && options?.method === 'POST') {
        return makeMockResponse({
          ok: false,
          status: 404,
          statusText: 'Not Found',
          json: async () => ({ error: 'ct_not_found' }),
        });
      }

      throw new Error(`Unexpected fetch: ${url}`);
    });

    global.fetch = fetchMock as any;

    await expect(
      tnSealOutputV2({
        ctHash: 1n,
        chainId: 1,
        acp: {} as any,
        thresholdNetworkUrl,
        onPoll,
      })
    ).rejects.toMatchObject({
      code: CofheErrorCode.CtNotFound,
      apiErrorCode: 'ct_not_found',
    });
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(onPoll).not.toHaveBeenCalled();
  });

  it('tnSealOutputV2 does not retry a 401 acp_denied submit', async () => {
    const onPoll = vi.fn();
    const fetchMock = vi.fn(async (url: string, options?: any) => {
      if (url === `${thresholdNetworkUrl}/v2/sealoutput` && options?.method === 'POST') {
        // The v2 error body carries the code only.
        return makeMockResponse({
          ok: false,
          status: 401,
          statusText: 'Unauthorized',
          json: async () => ({ error: 'acp_denied' }),
        });
      }

      throw new Error(`Unexpected fetch: ${url}`);
    });

    global.fetch = fetchMock as any;

    await expect(
      tnSealOutputV2({
        ctHash: 1n,
        chainId: 1,
        acp: {} as any,
        thresholdNetworkUrl,
        onPoll,
      })
    ).rejects.toMatchObject({ code: CofheErrorCode.ACPDenied, apiErrorCode: 'acp_denied' });
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(onPoll).not.toHaveBeenCalled();
  });

  it('tnSealOutputV2 retries acp_denied inside the access-denied retry window, then returns the result', async () => {
    const onPoll = vi.fn();
    let calls = 0;
    const fetchMock = vi.fn(async (url: string, options?: any) => {
      if (url === `${thresholdNetworkUrl}/v2/sealoutput` && options?.method === 'POST') {
        calls += 1;
        // The network has not seen the grant for the first two requests.
        if (calls <= 2) {
          return makeMockResponse({
            ok: false,
            status: 401,
            json: async () => ({ error: 'acp_denied' }),
          });
        }
        return makeMockResponse({
          ok: true,
          status: 200,
          json: async () => ({
            request_id: 'req-seal-after-grant',
            sealed_data: [1, 2, 3],
            ephemeral_public_key: [4, 5],
            nonce: [6],
            encryption_type: 4,
          }),
        });
      }

      throw new Error(`Unexpected fetch: ${url}`);
    });

    global.fetch = fetchMock as any;

    const promise = tnSealOutputV2({
      ctHash: 1n,
      chainId: 1,
      acp: {} as any,
      thresholdNetworkUrl,
      onPoll,
      accessDeniedRetryTimeoutMs: 30_000,
    });

    await vi.advanceTimersByTimeAsync(2_000);
    const result = await promise;

    expect(Array.from(result.data)).toEqual([1, 2, 3]);
    expect(fetchMock).toHaveBeenCalledTimes(3);
    expect(onPoll).toHaveBeenCalledTimes(2);
    expect(onPoll).toHaveBeenCalledWith(expect.objectContaining({ requestId: '', attemptIndex: 0 }));
  });

  it('tnSealOutputV2 fails with the denial once the access-denied retry window ends', async () => {
    const fetchMock = vi.fn(async (url: string, options?: any) => {
      if (url === `${thresholdNetworkUrl}/v2/sealoutput` && options?.method === 'POST') {
        return makeMockResponse({
          ok: false,
          status: 401,
          json: async () => ({ error: 'acp_denied' }),
        });
      }

      throw new Error(`Unexpected fetch: ${url}`);
    });

    global.fetch = fetchMock as any;

    const promise = tnSealOutputV2({
      ctHash: 1n,
      chainId: 1,
      acp: {} as any,
      thresholdNetworkUrl,
      accessDeniedRetryTimeoutMs: 3_000,
    });
    const rejection = expect(promise).rejects.toMatchObject({
      code: CofheErrorCode.ACPDenied,
      apiErrorCode: 'acp_denied',
    });

    await vi.advanceTimersByTimeAsync(5_000);
    await rejection;
    expect(fetchMock.mock.calls.length).toBeGreaterThan(1);
  });

  it('tnSealOutputV2 returns immediately when submit answers 200 with the result', async () => {
    const onPoll = vi.fn();

    const fetchMock = vi.fn(async (url: string, options?: any) => {
      if (url === `${thresholdNetworkUrl}/v2/sealoutput` && options?.method === 'POST') {
        return makeMockResponse({
          ok: true,
          status: 200,
          json: async () => ({
            request_id: 'req-seal-cached',
            sealed_data: [1, 2, 3],
            ephemeral_public_key: [4, 5],
            nonce: [6],
            encryption_type: 4,
          }),
        });
      }

      throw new Error(`Unexpected fetch: ${url}`);
    });

    global.fetch = fetchMock as any;

    const sealed = await tnSealOutputV2({
      ctHash: 1n,
      chainId: 1,
      acp: {} as any,
      thresholdNetworkUrl,
      onPoll,
    });

    expect(Array.from(sealed.data)).toEqual([1, 2, 3]);
    expect(Array.from(sealed.public_key)).toEqual([4, 5]);
    expect(Array.from(sealed.nonce)).toEqual([6]);
    expect(onPoll).not.toHaveBeenCalled();
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('tnSealOutputV2 gives up once the timeout budget is spent on 204 retries', async () => {
    const onPoll = vi.fn();
    const fetchMock = vi.fn(async (url: string, options?: any) => {
      if (url === `${thresholdNetworkUrl}/v2/sealoutput` && options?.method === 'POST') {
        return makeMockResponse({
          ok: true,
          status: 204,
          json: async () => {
            throw new Error('json() should not be called for 204 submit responses');
          },
        });
      }

      throw new Error(`Unexpected fetch: ${url}`);
    });

    global.fetch = fetchMock as any;

    const promise = tnSealOutputV2({ ctHash: 1n, chainId: 1, acp: {} as any, thresholdNetworkUrl, onPoll });
    const rejection = expect(promise).rejects.toMatchObject({
      message: 'sealOutput result was not ready after retrying for 300000ms',
    });

    await vi.advanceTimersByTimeAsync(310_000);

    await rejection;
    expect(onPoll).toHaveBeenLastCalledWith(
      expect.objectContaining({ operation: 'sealoutput', requestId: '', timeoutMs: 5 * 60 * 1000 })
    );
  });
});
