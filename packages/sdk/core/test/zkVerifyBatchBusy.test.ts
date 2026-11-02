import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { zkVerifyBatch } from '../encrypt/zkPackProveVerify';
import { CofheError, CofheErrorCode } from '../error';

const busy = (retryAfter?: string) =>
  new Response(JSON.stringify({ status: 'error', error: 'Server busy, retry shortly' }), {
    status: 503,
    headers: retryAfter === undefined ? {} : { 'Retry-After': retryAfter },
  });

const ok = () =>
  new Response(
    JSON.stringify({
      status: 'success',
      data: { ciphertexts: [{ ct_hash: '1', ct_type: 2 }], signature: '0x' + 'ab'.repeat(64), recid: 0 },
    }),
    { status: 200 }
  );

const verify = () =>
  zkVerifyBatch(
    'http://verifier.local',
    new Uint8Array([1]),
    '0x00000000000000000000000000000000000000aa',
    0,
    11155111,
    '0x00000000000000000000000000000000000000bb'
  );

describe('zkVerifyBatch when the verifier is busy', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it('sends the proof again after a 503 and returns the verified result', async () => {
    const fetchMock = vi.fn().mockResolvedValueOnce(busy('1')).mockResolvedValueOnce(ok());
    vi.stubGlobal('fetch', fetchMock);

    const pending = verify();
    await vi.advanceTimersByTimeAsync(999);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    await vi.advanceTimersByTimeAsync(1);

    const result = await pending;
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(result.outputs).toEqual([{ ct_hash: '1', ct_type: 2 }]);
    expect(fetchMock.mock.calls[1][1].body).toBe(fetchMock.mock.calls[0][1].body);
  });

  it('waits one second when Retry-After is missing and caps a long Retry-After at five seconds', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(busy())
      .mockResolvedValueOnce(busy('120'))
      .mockResolvedValueOnce(ok());
    vi.stubGlobal('fetch', fetchMock);

    const pending = verify();
    await vi.advanceTimersByTimeAsync(1000);
    expect(fetchMock).toHaveBeenCalledTimes(2);
    await vi.advanceTimersByTimeAsync(5000);

    await expect(pending).resolves.toBeDefined();
    expect(fetchMock).toHaveBeenCalledTimes(3);
  });

  it('fails with ZK_VERIFY_FAILED once the verifier is still busy after three retries', async () => {
    const fetchMock = vi.fn().mockImplementation(async () => busy('1'));
    vi.stubGlobal('fetch', fetchMock);

    const pending = verify();
    const assertion = expect(pending).rejects.toMatchObject({ code: CofheErrorCode.ZkVerifyFailed });
    await vi.advanceTimersByTimeAsync(3000);

    await assertion;
    await expect(pending).rejects.toBeInstanceOf(CofheError);
    expect(fetchMock).toHaveBeenCalledTimes(4);
  });

  it('does not retry other HTTP errors', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ status: 'error', error: 'invalid proof' }), { status: 400 })
      );
    vi.stubGlobal('fetch', fetchMock);

    await expect(verify()).rejects.toMatchObject({ code: CofheErrorCode.ZkVerifyFailed });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});
