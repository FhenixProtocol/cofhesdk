import { describe, it, expect, vi } from 'vitest';
import { classifySubmitResponse, throwIfSubmitRetryTimedOut } from '../decrypt/submitRetry.js';
import { CofheError, CofheErrorCode } from '../error.js';

const makeResponse = (opts: {
  ok: boolean;
  status: number;
  statusText?: string;
  json: () => Promise<unknown>;
}): Response => {
  return {
    ok: opts.ok,
    status: opts.status,
    statusText: opts.statusText ?? '',
    json: opts.json,
  } as unknown as Response;
};

describe('classifySubmitResponse', () => {
  it('classifies 204 as retryable without reading the body', async () => {
    const json = vi.fn(async () => {
      throw new Error('json() should not be called for 204');
    });
    const response = makeResponse({ ok: true, status: 204, json });

    const result = await classifySubmitResponse({ response, fallbackErrorCode: CofheErrorCode.DecryptFailed });

    expect(result).toEqual({ kind: 'retryable', status: 204 });
    expect(json).not.toHaveBeenCalled();
  });

  it('classifies 200 as parse-json', async () => {
    const response = makeResponse({ ok: true, status: 200, json: async () => ({}) });

    const result = await classifySubmitResponse({ response, fallbackErrorCode: CofheErrorCode.DecryptFailed });

    expect(result).toEqual({ kind: 'parse-json' });
  });

  it('classifies any 404 as fatal CtNotFound, whatever error code the body carries', async () => {
    const response = makeResponse({
      ok: false,
      status: 404,
      json: async () => ({ error: 'acp_denied', error_message: 'no ciphertext' }),
    });

    const result = await classifySubmitResponse({ response, fallbackErrorCode: CofheErrorCode.DecryptFailed });

    expect(result).toMatchObject({
      kind: 'fatal-http',
      status: 404,
      cofheErrorCode: CofheErrorCode.CtNotFound,
      apiErrorCode: 'ct_not_found',
      errorMessage: 'ciphertext not found: no ciphertext',
    });
  });

  it('classifies 404 with an unparsable body as fatal CtNotFound', async () => {
    const response = makeResponse({
      ok: false,
      status: 404,
      statusText: 'Not Found',
      json: async () => {
        throw new Error('not json');
      },
    });

    const result = await classifySubmitResponse({ response, fallbackErrorCode: CofheErrorCode.DecryptFailed });

    expect(result).toMatchObject({
      kind: 'fatal-http',
      status: 404,
      cofheErrorCode: CofheErrorCode.CtNotFound,
      apiErrorCode: 'ct_not_found',
    });
  });

  it('classifies other non-ok statuses as fatal with the mapped error code', async () => {
    const response = makeResponse({
      ok: false,
      status: 500,
      json: async () => ({ error: 'internal_error', error_message: 'decrypt task panicked' }),
    });

    const result = await classifySubmitResponse({ response, fallbackErrorCode: CofheErrorCode.SealOutputFailed });

    expect(result).toEqual({
      kind: 'fatal-http',
      status: 500,
      cofheErrorCode: CofheErrorCode.InternalError,
      apiErrorCode: 'internal_error',
      errorMessage: 'decrypt task panicked',
    });
  });
});

describe('throwIfSubmitRetryTimedOut', () => {
  const baseParams = {
    operationLabel: 'decrypt',
    errorCode: CofheErrorCode.DecryptFailed,
    thresholdNetworkUrl: 'http://threshold.local',
    body: { some: 'body' },
    attemptIndex: 3,
  };

  it('does not throw when under both budgets', () => {
    expect(() =>
      throwIfSubmitRetryTimedOut({
        ...baseParams,
        status: 204,
        elapsedMs: 1000,
        overallTimeoutMs: 300_000,
      })
    ).not.toThrow();
  });

  it('throws the generic operation error once the overall timeout elapses (204)', () => {
    try {
      throwIfSubmitRetryTimedOut({
        ...baseParams,
        status: 204,
        elapsedMs: 300_001,
        overallTimeoutMs: 300_000,
      });
      expect.fail('expected throwIfSubmitRetryTimedOut to throw');
    } catch (error) {
      const cofheError = error as CofheError;
      expect(cofheError.code).toBe(CofheErrorCode.DecryptFailed);
      expect(cofheError.apiErrorCode).toBeUndefined();
      expect(cofheError.message).toBe('decrypt submit retried without receiving request_id for 300000ms');
    }
  });
});
