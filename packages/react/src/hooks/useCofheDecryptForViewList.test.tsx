import { renderToString } from 'react-dom/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { FheTypes } from '@cofhe/sdk';
import { useCofheDecryptForViewList, type UseCofheDecryptForViewListInput } from './useCofheDecryptForViewList';

type QueryOptions = {
  enabled: boolean;
  queryKey: readonly unknown[];
  queryFn: () => Promise<unknown>;
  meta: Record<string, unknown>;
  initialData?: unknown;
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
  inputs,
  queryOptions,
}: {
  inputs: UseCofheDecryptForViewListInput<FheTypes>['inputs'];
  queryOptions?: Record<string, unknown>;
}) {
  useCofheDecryptForViewList({ inputs, meta: (input) => ({ label: `Bid ${input.ctHash}` }) }, queryOptions);
  return null;
}

describe('useCofheDecryptForViewList', () => {
  beforeEach(() => {
    state.acp = { acp: { hash: '0x1', type: 'self' }, isValid: true, scoped: false, status: 'valid' };
    state.queries = [];
  });

  it('runs one useCofheDecrypt-shaped query per input, in order, with per-entry meta', () => {
    renderToString(
      <Probe
        inputs={[{ ctHash: '42', utype: FheTypes.Uint64 } as const, { ctHash: '43', utype: FheTypes.Uint64 } as const]}
      />
    );

    expect(state.queries).toHaveLength(2);
    expect(state.queries[0].queryKey).toEqual(['decryptForView', 11155111, '42', FheTypes.Uint64, '0x1']);
    expect(state.queries[1].queryKey).toEqual(['decryptForView', 11155111, '43', FheTypes.Uint64, '0x1']);
    expect(state.queries.map((q) => q.enabled)).toEqual([true, true]);
    expect(state.queries[1].meta).toMatchObject({
      kind: 'cofheDecryptForView',
      persist: true,
      consumer: { label: 'Bid 43' },
    });
  });

  it('answers a zero handle without a request and leaves an undefined entry idle', () => {
    renderToString(<Probe inputs={[{ ctHash: '0x0', utype: FheTypes.Bool } as const, undefined]} />);

    expect(state.queries[0].enabled).toBe(false);
    expect(state.queries[0].initialData).toBe(false);
    expect(state.queries[0].staleTime).toBe(Infinity);
    expect(state.queries[1].enabled).toBe(false);
    expect(state.queries[1].initialData).toBeUndefined();
  });

  it('disables every entry without a valid ACP, and the out-of-scope ones under a SNAPSHOT share', () => {
    state.acp = { acp: { hash: '0x1', type: 'self' }, isValid: false, scoped: false, status: 'expired' };
    renderToString(<Probe inputs={[{ ctHash: '42', utype: FheTypes.Uint64 } as const]} />);
    expect(state.queries[0].enabled).toBe(false);

    state.acp = { acp: { hash: '0x3', type: 'shared', handles: ['42'] }, isValid: true, scoped: true, status: 'valid' };
    renderToString(
      <Probe
        inputs={[{ ctHash: '42', utype: FheTypes.Uint64 } as const, { ctHash: '43', utype: FheTypes.Uint64 } as const]}
      />
    );
    expect(state.queries.map((q) => q.enabled)).toEqual([true, false]);
  });

  it('keeps an explicit enabled: false', () => {
    renderToString(
      <Probe inputs={[{ ctHash: '42', utype: FheTypes.Uint64 } as const]} queryOptions={{ enabled: false }} />
    );
    expect(state.queries[0].enabled).toBe(false);
  });
});
