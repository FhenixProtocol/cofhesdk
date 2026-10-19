import { renderToString } from 'react-dom/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { CofheError, CofheErrorCode, FheTypes } from '@cofhe/sdk';
import { useCofheDecryptFn, type UseCofheDecryptFnResult } from './useCofheDecryptFn';

type FetchQueryOptions = {
  queryKey: readonly unknown[];
  queryFn: () => Promise<unknown>;
  meta: Record<string, unknown>;
  staleTime: number;
  retry: (failureCount: number, error: Error) => boolean;
};

const state = vi.hoisted(() => ({
  acp: {
    acp: { hash: '0x1', type: 'self' } as { hash: string; type: string } | undefined,
    isValid: true,
    scoped: false,
    status: 'valid',
  },
  fetchQuery: undefined as unknown as ReturnType<typeof vi.fn>,
  client: undefined as unknown,
}));

vi.mock('@/providers', () => ({
  useCofheContext: () => ({ client: state.client }),
  useInternalQueryClient: () => ({ fetchQuery: state.fetchQuery, removeQueries: vi.fn() }),
}));

vi.mock('./useCofheACPScope', () => ({
  useCofheEffectiveACP: () => state.acp,
  isHandleOutOfScope: (acp: { scope?: string; handles?: string[] } | undefined, ctHash: string) =>
    !!acp?.handles && !acp.handles.includes(ctHash),
}));

vi.mock('./useCofheConnection', () => ({
  useCofheChainId: () => 11155111,
}));

/** A fake client whose view builder records what was configured on it. */
function fakeClient(result: unknown = 5n) {
  const builder = {
    setChainId: vi.fn(() => builder),
    withACP: vi.fn(() => builder),
    onPoll: vi.fn(() => builder),
    setTimeout: vi.fn(() => builder),
    execute: vi.fn(async () => result),
  };
  return { builder, client: { decryptForView: vi.fn(() => builder) } };
}

let hook: UseCofheDecryptFnResult;
function Probe({ concurrency }: { concurrency?: number }) {
  hook = useCofheDecryptFn({ concurrency });
  return null;
}

const UINT64 = { ctHash: '42', utype: FheTypes.Uint64 } as const;

describe('useCofheDecryptFn', () => {
  beforeEach(() => {
    state.acp = { acp: { hash: '0x1', type: 'self' }, isValid: true, scoped: false, status: 'valid' };
    state.fetchQuery = vi.fn(async (options: FetchQueryOptions) => options.queryFn());
    state.client = fakeClient().client;
  });

  it('runs the same query as useCofheDecrypt: key, persisted meta, staleTime Infinity, default retry', async () => {
    renderToString(<Probe />);

    await expect(hook.decrypt(UINT64)).resolves.toBe(5n);

    expect(hook.isReady).toBe(true);
    const options = state.fetchQuery.mock.calls[0][0] as FetchQueryOptions;
    expect(options.queryKey).toEqual(['decryptCiphertext', 11155111, '42', FheTypes.Uint64, '0x1']);
    expect(options.meta).toMatchObject({ kind: 'cofheDecrypt', ctHash: '42', chainId: 11155111, persist: true });
    expect(options.staleTime).toBe(Infinity);
    expect(options.retry(0, new Error('temporary'))).toBe(true);
    expect(options.retry(0, new CofheError({ code: CofheErrorCode.InternalError, message: 'final' }))).toBe(false);
  });

  it('configures the builder from the call options and decrypts with a scoped ACP', async () => {
    const acp = { hash: '0x2', type: 'shared' };
    state.acp = { acp, isValid: true, scoped: true, status: 'valid' };
    const { client, builder } = fakeClient(7n);
    state.client = client;
    renderToString(<Probe />);
    const onPoll = () => {};

    await expect(hook.decrypt(UINT64, { timeoutMs: 20_000, onPoll, meta: { label: 'Bid' } })).resolves.toBe(7n);

    expect(client.decryptForView).toHaveBeenCalledWith('42', FheTypes.Uint64);
    expect(builder.withACP).toHaveBeenCalledWith(acp);
    expect(builder.setTimeout).toHaveBeenCalledWith(20_000);
    expect(builder.onPoll).toHaveBeenCalledWith(onPoll);
    const options = state.fetchQuery.mock.calls[0][0] as FetchQueryOptions;
    expect(options.queryKey[4]).toBe('0x2');
    expect(options.meta).toMatchObject({ persist: false, consumer: { label: 'Bid' } });
  });

  it('resolves a zero handle to the type zero without a request', async () => {
    renderToString(<Probe />);

    await expect(hook.decrypt({ ctHash: '0x0', utype: FheTypes.Uint64 })).resolves.toBe(0n);
    await expect(hook.decrypt({ ctHash: '0', utype: FheTypes.Bool })).resolves.toBe(false);
    expect(state.fetchQuery).not.toHaveBeenCalled();
  });

  it('rejects without a valid ACP and sends nothing', async () => {
    state.acp = { acp: { hash: '0x1', type: 'self' }, isValid: false, scoped: false, status: 'expired' };
    renderToString(<Probe />);

    expect(hook.isReady).toBe(false);
    await expect(hook.decrypt(UINT64)).rejects.toMatchObject({ code: CofheErrorCode.ACPExpired });
    expect(state.fetchQuery).not.toHaveBeenCalled();
  });

  it('rejects a handle a SNAPSHOT share does not list', async () => {
    state.acp = {
      acp: { hash: '0x3', type: 'shared', handles: ['1'] } as never,
      isValid: true,
      scoped: true,
      status: 'valid',
    };
    renderToString(<Probe />);

    await expect(hook.decrypt(UINT64)).rejects.toMatchObject({ code: CofheErrorCode.ACPDenied });
    expect(state.fetchQuery).not.toHaveBeenCalled();
  });

  it('runs at most `concurrency` requests at a time', async () => {
    const resolvers: Array<(value: bigint) => void> = [];
    state.fetchQuery = vi.fn(() => new Promise<bigint>((resolve) => resolvers.push(resolve)));
    renderToString(<Probe concurrency={2} />);

    const all = Promise.all([hook.decrypt(UINT64), hook.decrypt(UINT64), hook.decrypt(UINT64)]);
    await Promise.resolve();
    expect(state.fetchQuery).toHaveBeenCalledTimes(2);

    resolvers[0](1n);
    await Promise.resolve();
    await Promise.resolve();
    expect(state.fetchQuery).toHaveBeenCalledTimes(3);

    resolvers[1](2n);
    resolvers[2](3n);
    await expect(all).resolves.toEqual([1n, 2n, 3n]);
  });
});
