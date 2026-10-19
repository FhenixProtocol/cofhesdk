import { renderToString } from 'react-dom/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useCofheDecryptForTx, type CofheDecryptForTxVariables } from './useCofheDecryptForTx';

type MutationOptions = {
  mutationKey: unknown[];
  mutationFn: (variables: CofheDecryptForTxVariables) => Promise<unknown>;
};

const state = vi.hoisted(() => ({
  options: undefined as unknown as MutationOptions,
  client: undefined as unknown,
}));

vi.mock('@/providers', () => ({
  useCofheContext: () => ({ client: state.client }),
  useInternalMutation: (options: MutationOptions) => {
    state.options = options;
    return { mutate: vi.fn(), mutateAsync: vi.fn(), isPending: false };
  },
}));

/** A fake client whose tx builder records the mode and settings chosen on it. */
function fakeClient() {
  const result = { ctHash: '0x1', decryptedValue: 9n, signature: '0xsig' };
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

function Probe() {
  useCofheDecryptForTx();
  return null;
}

describe('useCofheDecryptForTx', () => {
  let fake: ReturnType<typeof fakeClient>;

  beforeEach(() => {
    fake = fakeClient();
    state.client = fake.client;
    renderToString(<Probe />);
  });

  it('registers a mutation under the cofhe key', () => {
    expect(state.options.mutationKey).toEqual(['cofhe', 'decryptForTx']);
  });

  it('`acp: null` decrypts a publicly allowed handle without an ACP', async () => {
    await expect(state.options.mutationFn({ ctHash: '0x1', acp: null })).resolves.toBe(fake.result);

    expect(fake.client.decryptForTx).toHaveBeenCalledWith('0x1');
    expect(fake.builder.withoutACP).toHaveBeenCalledOnce();
    expect(fake.builder.withACP).not.toHaveBeenCalled();
  });

  it('no `acp` decrypts with the active ACP', async () => {
    await state.options.mutationFn({ ctHash: 1n });

    expect(fake.builder.withACP).toHaveBeenCalledWith();
    expect(fake.builder.withoutACP).not.toHaveBeenCalled();
  });

  it('an ACP or a stored hash is passed to the builder', async () => {
    const acp = { hash: '0x2' } as never;
    await state.options.mutationFn({ ctHash: 1n, acp });
    await state.options.mutationFn({ ctHash: 1n, acp: '0x3' });

    expect(fake.builder.withACP).toHaveBeenNthCalledWith(1, acp);
    expect(fake.builder.withACP).toHaveBeenNthCalledWith(2, '0x3');
  });

  it('maps the other variables onto the builder', async () => {
    const onPoll = () => {};
    await state.options.mutationFn({
      ctHash: 1n,
      acp: null,
      chainId: 421614,
      account: '0xabc',
      onPoll,
      timeoutMs: 20_000,
      retry404TimeoutMs: 15_000,
    });

    expect(fake.builder.setChainId).toHaveBeenCalledWith(421614);
    expect(fake.builder.setAccount).toHaveBeenCalledWith('0xabc');
    expect(fake.builder.onPoll).toHaveBeenCalledWith(onPoll);
    expect(fake.builder.setTimeout).toHaveBeenCalledWith(20_000);
    expect(fake.builder.set404RetryTimeout).toHaveBeenCalledWith(15_000);
  });

  it('rejects without a client', async () => {
    state.client = undefined;
    renderToString(<Probe />);

    await expect(state.options.mutationFn({ ctHash: 1n, acp: null })).rejects.toThrow('CoFHE client not initialized');
  });
});
