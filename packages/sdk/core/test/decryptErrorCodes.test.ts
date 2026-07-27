import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { tnDecryptV2 } from '../decrypt/tnDecryptV2.js';
import { tnSealOutputV2 } from '../decrypt/tnSealOutputV2.js';
import { CofheErrorCode } from '../error.js';

// Cross-reference: API-RESPONSES.md's "Shared errors" table (applies to all decrypt/sealoutput
// submit and poll endpoints).
const SHARED_ERROR_CASES: Array<{ status: number; error: string; cofheErrorCode: CofheErrorCode }> = [
  { status: 400, error: 'bad_request', cofheErrorCode: CofheErrorCode.BadRequest },
  { status: 400, error: 'unknown_chain', cofheErrorCode: CofheErrorCode.UnknownChain },
  { status: 400, error: 'permit_malformed', cofheErrorCode: CofheErrorCode.PermitMalformed },
  { status: 401, error: 'permit_denied', cofheErrorCode: CofheErrorCode.PermitDenied },
  { status: 401, error: 'permit_expired', cofheErrorCode: CofheErrorCode.PermitExpired },
  { status: 401, error: 'permit_invalid', cofheErrorCode: CofheErrorCode.PermitInvalid },
  { status: 403, error: 'not_publicly_allowed', cofheErrorCode: CofheErrorCode.NotPubliclyAllowed },
  { status: 422, error: 'unsupported_security_zone', cofheErrorCode: CofheErrorCode.UnsupportedSecurityZone },
  { status: 422, error: 'unsupported_type', cofheErrorCode: CofheErrorCode.UnsupportedType },
  { status: 500, error: 'internal_error', cofheErrorCode: CofheErrorCode.InternalError },
  { status: 500, error: 'signing_failed', cofheErrorCode: CofheErrorCode.SigningFailed },
  { status: 502, error: 'ct_source_error', cofheErrorCode: CofheErrorCode.CtSourceError },
  { status: 502, error: 'permit_verifier_error', cofheErrorCode: CofheErrorCode.PermitVerifierError },
  { status: 504, error: 'ct_source_timeout', cofheErrorCode: CofheErrorCode.CtSourceTimeout },
  { status: 504, error: 'permit_verifier_timeout', cofheErrorCode: CofheErrorCode.PermitVerifierTimeout },
];
// ct_not_found (404) is deliberately excluded here: on the submit endpoints it's the
// conditionally-retryable case (covered by pollCallbacks.test.ts / submitRetry.test.ts), and on
// the poll endpoints it's documented bodyless (covered separately below).

const makeMockResponse = (opts: { ok: boolean; status?: number; statusText?: string; json: () => Promise<any> }) => {
  return {
    ok: opts.ok,
    status: opts.status ?? (opts.ok ? 200 : 500),
    statusText: opts.statusText ?? '',
    json: opts.json,
  } as unknown as Response;
};

describe('decrypt/sealoutput API-RESPONSES.md error-code coverage', () => {
  const thresholdNetworkUrl = 'http://threshold.local';

  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  describe.each([
    { operation: 'decrypt' as const, path: '/v2/decrypt', run: tnDecryptV2, fallback: CofheErrorCode.DecryptFailed },
    {
      operation: 'sealoutput' as const,
      path: '/v2/sealoutput',
      run: tnSealOutputV2,
      fallback: CofheErrorCode.SealOutputFailed,
    },
  ])('$operation submit ($path)', ({ path, run, fallback }) => {
    it.each(SHARED_ERROR_CASES)('maps $status $error to the dedicated CofheErrorCode', async ({ status, error }) => {
      const fetchMock = vi.fn(async (url: string) => {
        if (url === `${thresholdNetworkUrl}${path}`) {
          return makeMockResponse({
            ok: false,
            status,
            json: async () => ({ error, error_message: `backend said ${error}` }),
          });
        }
        throw new Error(`Unexpected fetch: ${url}`);
      });
      global.fetch = fetchMock as any;

      const expectedCode = SHARED_ERROR_CASES.find((c) => c.error === error)!.cofheErrorCode;

      await expect(
        run({ ctHash: 1n, chainId: 1, permission: {} as any, thresholdNetworkUrl } as any)
      ).rejects.toMatchObject({
        code: expectedCode,
        apiErrorCode: error,
        message: expect.stringContaining(`backend said ${error}`),
      });
      expect(fetchMock).toHaveBeenCalledTimes(1);
    });

    it('falls back to the operation-level generic code for an unrecognized future error code', async () => {
      const fetchMock = vi.fn(async () =>
        makeMockResponse({
          ok: false,
          status: 400,
          json: async () => ({ error: 'some_future_code', error_message: 'not yet known to the SDK' }),
        })
      );
      global.fetch = fetchMock as any;

      await expect(
        run({ ctHash: 1n, chainId: 1, permission: {} as any, thresholdNetworkUrl } as any)
      ).rejects.toMatchObject({
        code: fallback,
        apiErrorCode: 'some_future_code',
      });
    });

    it('degrades gracefully on a plain-text framework rejection (e.g. 415)', async () => {
      const fetchMock = vi.fn(async () =>
        makeMockResponse({
          ok: false,
          status: 415,
          statusText: 'Unsupported Media Type',
          json: async () => {
            throw new Error('body is plain text, not JSON');
          },
        })
      );
      global.fetch = fetchMock as any;

      await expect(
        run({ ctHash: 1n, chainId: 1, permission: {} as any, thresholdNetworkUrl } as any)
      ).rejects.toMatchObject({
        code: fallback,
        apiErrorCode: undefined,
        message: expect.stringContaining('Unsupported Media Type'),
      });
    });
  });

  it('sealoutput submit maps 400 permit_required (sealoutput-specific)', async () => {
    global.fetch = vi.fn(async () =>
      makeMockResponse({
        ok: false,
        status: 400,
        json: async () => ({ error: 'permit_required', error_message: 'no permit in request' }),
      })
    ) as any;

    await expect(
      tnSealOutputV2({ ctHash: 1n, chainId: 1, permission: {} as any, thresholdNetworkUrl })
    ).rejects.toMatchObject({
      code: CofheErrorCode.PermitRequired,
      apiErrorCode: 'permit_required',
    });
  });

  it('sealoutput submit maps 500 seal_failed (sealoutput-specific)', async () => {
    global.fetch = vi.fn(async () =>
      makeMockResponse({
        ok: false,
        status: 500,
        json: async () => ({ error: 'seal_failed', error_message: 'sealing crypto failed' }),
      })
    ) as any;

    await expect(
      tnSealOutputV2({ ctHash: 1n, chainId: 1, permission: {} as any, thresholdNetworkUrl })
    ).rejects.toMatchObject({
      code: CofheErrorCode.SealFailed,
      apiErrorCode: 'seal_failed',
    });
  });

  describe.each([
    {
      operation: 'decrypt' as const,
      submitPath: '/v2/decrypt',
      statusPath: (id: string) => `/v2/decrypt/${id}`,
      run: tnDecryptV2,
      fallback: CofheErrorCode.DecryptFailed,
    },
    {
      operation: 'sealoutput' as const,
      submitPath: '/v2/sealoutput',
      statusPath: (id: string) => `/v2/sealoutput/${id}`,
      run: tnSealOutputV2,
      fallback: CofheErrorCode.SealOutputFailed,
    },
  ])('$operation poll (GET status endpoint)', ({ submitPath, statusPath, run, fallback }) => {
    const requestId = 'req-poll-errors';

    it('maps a non-404 non-ok status via the shared error table (e.g. 500 internal_error)', async () => {
      const fetchMock = vi.fn(async (url: string) => {
        if (url === `${thresholdNetworkUrl}${submitPath}`) {
          return makeMockResponse({ ok: true, json: async () => ({ request_id: requestId }) });
        }
        if (url === `${thresholdNetworkUrl}${statusPath(requestId)}`) {
          return makeMockResponse({
            ok: false,
            status: 500,
            json: async () => ({ error: 'internal_error', error_message: 'decrypt task panicked' }),
          });
        }
        throw new Error(`Unexpected fetch: ${url}`);
      });
      global.fetch = fetchMock as any;

      const promise = run({ ctHash: 1n, chainId: 1, permission: {} as any, thresholdNetworkUrl } as any);

      await expect(promise).rejects.toMatchObject({
        code: CofheErrorCode.InternalError,
        apiErrorCode: 'internal_error',
        message: expect.stringContaining('decrypt task panicked'),
      });
    });

    it('throws immediately on a bodyless 404 (unknown/evicted request_id) without calling response.json()', async () => {
      const statusJson = vi.fn(async () => {
        throw new Error('json() should not be called for a bodyless 404');
      });
      const fetchMock = vi.fn(async (url: string) => {
        if (url === `${thresholdNetworkUrl}${submitPath}`) {
          return makeMockResponse({ ok: true, json: async () => ({ request_id: requestId }) });
        }
        if (url === `${thresholdNetworkUrl}${statusPath(requestId)}`) {
          return makeMockResponse({ ok: false, status: 404, json: statusJson });
        }
        throw new Error(`Unexpected fetch: ${url}`);
      });
      global.fetch = fetchMock as any;

      const promise = run({ ctHash: 1n, chainId: 1, permission: {} as any, thresholdNetworkUrl } as any);

      await expect(promise).rejects.toMatchObject({ code: fallback });
      expect(statusJson).not.toHaveBeenCalled();
    });
  });
});
