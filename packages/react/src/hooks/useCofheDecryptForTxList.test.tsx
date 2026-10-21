import { renderToString } from 'react-dom/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useCofheDecryptForTxList, type UseCofheDecryptForTxListInput } from './useCofheDecryptForTxList';

type QueryOptions = {
  enabled: boolean;
  queryKey: readonly unknown[];
  queryFn: () => Promise<unknown>;
  meta: Record<string, unknown>;
  staleTime?: number;
};

const state = vi.hoisted(() => ({
  acp: {
    acp: { hash: '0x1', type: 'self' } as { hash: string; type: string; handles?: string[] } | undefined,
    isValid: true,
    scoped: false,
    status: 'valid',
  },
  queries: [] as QueryOptions[],
}));

vi.mock('@/providers', () => ({
  useCofheContext: () => ({ client: {} }),
  useInternalQueryClient: () => ({ removeQueries: vi.fn() }),
  useInternalQueries: (options: { queries: QueryOptions[] }) => {
    state.queries = options.queries;
    return options.queries.map(() => ({}));
  },
}));

vi.mock('@/providers/acpDecryptCache', () => ({ removeDecryptsOfACPs: vi.fn() }));

vi.mock('./useCofheACPScope', () => ({
  useCofheEffectiveACP: () => state.acp,
  isHandleOutOfScope: (acp: { handles?: string[] } | undefined, ctHash: string) =>
    !!acp?.handles && !acp.handles.includes(ctHash),
}));

vi.mock('./useCofheConnection', () => ({ useCofheChainId: () => 11155111 }));

function Probe({
  input,
  queryOptions,
}: {
  input: UseCofheDecryptForTxListInput;
  queryOptions?: Record<string, unknown>;
}) {
  useCofheDecryptForTxList(input, queryOptions);
  return null;
}

describe('useCofheDecryptForTxList', () => {
  beforeEach(() => {
    state.acp = { acp: { hash: '0x1', type: 'self' }, isValid: true, scoped: false, status: 'valid' };
    state.queries = [];
  });

  it('runs one useCofheDecryptForTx-shaped query per handle, in order, staleTime Infinity, per-entry meta', () => {
    renderToString(
      <Probe input={{ inputs: ['42', 43n], acp: null, meta: (ctHash) => ({ label: `Level ${ctHash}` }) }} />
    );

    expect(state.queries).toHaveLength(2);
    expect(state.queries[0].queryKey).toEqual(['decryptForTx', 11155111, '42', null]);
    expect(state.queries[1].queryKey).toEqual(['decryptForTx', 11155111, '43', null]);
    expect(state.queries.map((q) => q.enabled)).toEqual([true, true]);
    expect(state.queries[0].staleTime).toBe(Infinity);
    expect(state.queries[1].meta).toMatchObject({
      kind: 'cofheDecryptForTx',
      persist: true,
      consumer: { label: 'Level 43' },
    });
  });

  it('`acp: null` does not wait for a valid ACP; without it an invalid ACP disables every entry', () => {
    state.acp = { acp: undefined, isValid: false, scoped: false, status: 'missing' };
    renderToString(<Probe input={{ inputs: ['42'], acp: null }} />);
    expect(state.queries[0].enabled).toBe(true);

    renderToString(<Probe input={{ inputs: ['42'] }} />);
    expect(state.queries[0].enabled).toBe(false);
  });

  it('leaves the zero handle and an undefined entry idle, and keeps an explicit enabled: false', () => {
    renderToString(<Probe input={{ inputs: ['0x0', undefined, '42'], acp: null }} queryOptions={{ enabled: false }} />);
    expect(state.queries.map((q) => q.enabled)).toEqual([false, false, false]);

    renderToString(<Probe input={{ inputs: ['0x0', undefined, '42'], acp: null }} />);
    expect(state.queries.map((q) => q.enabled)).toEqual([false, false, true]);
  });
});
