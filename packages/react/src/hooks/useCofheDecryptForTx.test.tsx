import { renderToString } from 'react-dom/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { CofheError, CofheErrorCode } from '@cofhe/sdk';
import { useCofheDecryptForTx, type UseCofheDecryptForTxInput } from './useCofheDecryptForTx';

type QueryOptions = {
  enabled: boolean;
  queryKey: readonly unknown[];
  queryFn: () => Promise<unknown>;
  meta: Record<string, unknown>;
  staleTime: number;
  retry: boolean | number | ((failureCount: number, error: Error) => boolean);
};

const state = vi.hoisted(() => ({
  acp: {
    acp: { hash: '0x1', type: 'self' } as { hash: string; type: string; handles?: string[] } | undefined,
    isValid: true,
    scoped: false,
    status: 'valid',
  },
  options: undefined as unknown as QueryOptions,
  client: undefined as unknown,
}));

vi.mock('@/providers', () => ({
  useCofheContext: () => ({ client: state.client }),
  useInternalQueryClient: () => ({ removeQueries: vi.fn() }),
  useInternalQuery: (options: QueryOptions) => {
    state.options = options;
    return {};
  },
}));

vi.mock('@/providers/acpDecryptCache', () => ({
  removeDecryptsOfACPs: vi.fn(),
}));

vi.mock('./useCofheACPScope', () => ({
  useCofheEffectiveACP: () => state.acp,
  isHandleOutOfScope: (acp: { handles?: string[] } | undefined, ctHash: string) =>
    !!acp?.handles && !acp.handles.includes(ctHash),
}));

vi.mock('./useCofheConnection', () => ({
  useCofheChainId: () => 11155111,
}));

/** A fake client whose tx builder records the mode and settings chosen on it. */
function fakeClient() {
  const result = { ctHash: '42', decryptedValue: 9n, signature: '0xsig' };
  const builder = {
    setChainId: vi.fn(() => builder),
    setAccount: vi.fn(() => builder),
    onPoll: vi.fn(() => builder),
    setTimeout: vi.fn(() => builder),
    set404RetryTimeout: vi.fn(() => builder),
    withACP: vi.fn(() => builder),
    withoutACP: vi.fn(() => builder),
    execute: vi.fn(async () => result),
  };
  return { builder, result, client: { decryptForTx: vi.fn(() => builder) } };
}

function Probe({ input, queryOptions }: { input: UseCofheDecryptForTxInput; queryOptions?: Record<string, unknown> }) {
  useCofheDecryptForTx(input, queryOptions);
  return null;
}

describe('useCofheDecryptForTx', () => {
  let fake: ReturnType<typeof fakeClient>;

  beforeEach(() => {
    fake = fakeClient();
    state.client = fake.client;
    state.acp = { acp: { hash: '0x1', type: 'self' }, isValid: true, scoped: false, status: 'valid' };
  });

  it('is a cached query: key, persisted meta, staleTime Infinity, default retry', () => {
    renderToString(<Probe input={{ ctHash: '42' }} />);

    expect(state.options.enabled).toBe(true);
    expect(state.options.queryKey).toEqual(['decryptForTx', 11155111, '42', '0x1']);
    expect(state.options.meta).toMatchObject({
      kind: 'cofheDecryptForTx',
      ctHash: '42',
      chainId: 11155111,
      persist: true,
    });
    expect(state.options.staleTime).toBe(Infinity);
    const retry = state.options.retry as (failureCount: number, error: Error) => boolean;
    expect(retry(0, new Error('temporary'))).toBe(true);
    expect(retry(0, new CofheError({ code: CofheErrorCode.InternalError, message: 'final' }))).toBe(false);
  });

  it('`acp: null` keys the proof without an ACP, persists it, and does not wait for a valid ACP', async () => {
    state.acp = { acp: undefined, isValid: false, scoped: false, status: 'missing' };
    renderToString(<Probe input={{ ctHash: 42n, acp: null }} />);

    expect(state.options.enabled).toBe(true);
    expect(state.options.queryKey).toEqual(['decryptForTx', 11155111, '42', null]);
    expect(state.options.meta).toMatchObject({ persist: true });

    await expect(state.options.queryFn()).resolves.toBe(fake.result);
    expect(fake.client.decryptForTx).toHaveBeenCalledWith(42n);
    expect(fake.builder.withoutACP).toHaveBeenCalledOnce();
    expect(fake.builder.withACP).not.toHaveBeenCalled();
  });

  it('decrypts with the active ACP when none is chosen, and with the scoped one when it is', async () => {
    renderToString(<Probe input={{ ctHash: '42' }} />);
    await state.options.queryFn();
    expect(fake.builder.withACP).toHaveBeenCalledWith();

    const shared = { hash: '0x2', type: 'shared' };
    state.acp = { acp: shared, isValid: true, scoped: true, status: 'valid' };
    fake = fakeClient();
    state.client = fake.client;
    renderToString(<Probe input={{ ctHash: '42' }} />);
    await state.options.queryFn();
    expect(fake.builder.withACP).toHaveBeenCalledWith(shared);
    expect(state.options.queryKey[3]).toBe('0x2');
    expect(state.options.meta).toMatchObject({ persist: false });
  });

  it('maps the other inputs onto the builder', async () => {
    const onPoll = () => {};
    renderToString(
      <Probe
        input={{
          ctHash: '42',
          acp: null,
          chainId: 421614,
          account: '0xabc',
          onPoll,
          timeoutMs: 20_000,
          retry404TimeoutMs: 15_000,
        }}
      />
    );

    expect(state.options.queryKey[1]).toBe(421614);
    await state.options.queryFn();
    expect(fake.builder.setChainId).toHaveBeenCalledWith(421614);
    expect(fake.builder.setAccount).toHaveBeenCalledWith('0xabc');
    expect(fake.builder.onPoll).toHaveBeenCalledWith(onPoll);
    expect(fake.builder.setTimeout).toHaveBeenCalledWith(20_000);
    expect(fake.builder.set404RetryTimeout).toHaveBeenCalledWith(15_000);
  });

  it('is disabled without a handle, for the zero handle, without a client, or without a valid ACP', () => {
    renderToString(<Probe input={{}} />);
    expect(state.options.enabled).toBe(false);

    renderToString(<Probe input={{ ctHash: '0x0' }} />);
    expect(state.options.enabled).toBe(false);

    state.client = undefined;
    renderToString(<Probe input={{ ctHash: '42', acp: null }} />);
    expect(state.options.enabled).toBe(false);

    state.client = fake.client;
    state.acp = { acp: { hash: '0x1', type: 'self' }, isValid: false, scoped: false, status: 'expired' };
    renderToString(<Probe input={{ ctHash: '42' }} />);
    expect(state.options.enabled).toBe(false);
  });

  it('is disabled for a handle a SNAPSHOT share does not list', () => {
    state.acp = { acp: { hash: '0x3', type: 'shared', handles: ['1'] }, isValid: true, scoped: true, status: 'valid' };
    renderToString(<Probe input={{ ctHash: '42' }} />);
    expect(state.options.enabled).toBe(false);
  });

  it('keeps explicit query options: enabled, staleTime, retry', () => {
    renderToString(<Probe input={{ ctHash: '42' }} queryOptions={{ enabled: false, staleTime: 0, retry: false }} />);

    expect(state.options.enabled).toBe(false);
    expect(state.options.staleTime).toBe(0);
    expect(state.options.retry).toBe(false);
  });
});
