import { afterEach, describe, expect, it, vi } from 'vitest';
import { zkVerifyBatch } from '../encrypt/zkPackProveVerify.js';
import { tnDecryptV1 } from '../decrypt/tnDecryptV1.js';
import { CofheError, CofheErrorCode } from '../error.js';

const verify = () =>
  zkVerifyBatch(
    'http://verifier.local',
    new Uint8Array([1]),
    '0x00000000000000000000000000000000000000aa',
    0,
    11155111,
    '0x00000000000000000000000000000000000000bb'
  );

const rejection = (promise: Promise<unknown>) =>
  promise.then(
    () => {
      throw new Error('expected a rejection');
    },
    (e: unknown) => e as CofheError
  );

describe('httpStatus on errors from an HTTP response', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('zkVerifyBatch keeps the status of a verifier error, with the same code and message', async () => {
    // What the verifier answers for an empty batch.
    const body = JSON.stringify({ status: 'error', data: { message: 'cannot sign an empty batch of ciphertexts' } });
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(body, { status: 400 })));

    const error = await rejection(verify());

    expect(error).toBeInstanceOf(CofheError);
    expect(error.code).toBe(CofheErrorCode.ZkVerifyFailed);
    expect(error.httpStatus).toBe(400);
    expect(error.message).toBe(
      `ZK batch proof verification failed | Caused by: HTTP error! ZK batch proof verification failed - ${body}`
    );
    expect(error.toString()).toContain('[ZK_VERIFY_FAILED] (http: 400)');
  });

  it('zkVerifyBatch leaves httpStatus unset when no response arrived', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new TypeError('Failed to fetch')));

    const error = await rejection(verify());

    expect(error.code).toBe(CofheErrorCode.ZkVerifyFailed);
    expect(error.httpStatus).toBeUndefined();
  });

  it('tnDecryptV1 keeps the status of a threshold network error', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(new Response(JSON.stringify({ error_message: 'acp denied' }), { status: 401 }))
    );

    const error = await rejection(tnDecryptV1(1n, 1, null, 'http://threshold.local'));

    expect(error.code).toBe(CofheErrorCode.DecryptFailed);
    expect(error.httpStatus).toBe(401);
  });

  it('serialize includes httpStatus', () => {
    const error = new CofheError({ code: CofheErrorCode.ZkVerifyFailed, message: 'm', httpStatus: 503 });
    expect(JSON.parse(error.serialize()).httpStatus).toBe(503);
  });
});
