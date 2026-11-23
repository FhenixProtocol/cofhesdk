import { renderToString } from 'react-dom/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { ConfidentialToken } from '@/types/token';

const CONNECTED_CHAIN_ID = 84532;
const OTHER_CHAIN_ID = 11155111;
const ACCOUNT = '0x0000000000000000000000000000000000000001';

type CapturedQuery = { enabled: boolean; queryKey: readonly unknown[] };

const mocks = vi.hoisted(() => ({
  queries: [] as CapturedQuery[],
  tokensChainId: undefined as number | undefined,
  publicClient: undefined as object | undefined,
}));

vi.mock('@/providers', () => ({
  useInternalQueries: ({
    queries,
    combine,
  }: {
    queries: CapturedQuery[];
    combine: (results: unknown[]) => unknown;
  }) => {
    mocks.queries = queries;
    return combine([]);
  },
}));

vi.mock('./useCofheConnection', () => ({
  useCofheConnection: () => ({ publicClient: mocks.publicClient, chainId: CONNECTED_CHAIN_ID }),
  useCofheAccount: () => ACCOUNT,
  useCofheChainId: () => CONNECTED_CHAIN_ID,
}));

vi.mock('./useCofheACPScope', () => ({
  useCofheEffectiveACP: () => ({ isValid: false, acp: undefined }),
}));

vi.mock('./useCofheTokenLists', () => ({
  useCofheTokens: (chainId?: number): ConfidentialToken[] => {
    mocks.tokensChainId = chainId;
    return [
      {
        chainId: chainId!,
        address: '0x3Cdcdd0EB7311a59fDe92D44B01165B2Ca2019C4',
        name: 'fhETH',
        symbol: 'fhETH',
        decimals: 6,
        extensions: { fhenix: { confidentialityType: 'wrappedNative', confidentialValueType: 'uint64' } },
      },
    ];
  },
}));

import { useCofheTokensWithExistingEncryptedBalances } from './useCofheTokensWithExistingEncryptedBalances';

function Probe({ chainId, enabled }: { chainId?: number; enabled?: boolean }) {
  useCofheTokensWithExistingEncryptedBalances({ chainId }, enabled === undefined ? undefined : { enabled });
  return null;
}

describe('useCofheTokensWithExistingEncryptedBalances', () => {
  beforeEach(() => {
    mocks.queries = [];
    mocks.tokensChainId = undefined;
    mocks.publicClient = { chain: { id: CONNECTED_CHAIN_ID } };
  });

  it('reads the connected chain when no explicit chain is provided', () => {
    renderToString(<Probe />);

    expect(mocks.tokensChainId).toBe(CONNECTED_CHAIN_ID);
    expect(mocks.queries).toHaveLength(1);
    expect(mocks.queries[0]?.enabled).toBe(true);
    expect(mocks.queries[0]?.queryKey).toContain(CONNECTED_CHAIN_ID);
  });

  it('reads when an explicit chain matches the connected chain', () => {
    renderToString(<Probe chainId={CONNECTED_CHAIN_ID} />);

    expect(mocks.queries[0]?.enabled).toBe(true);
    expect(mocks.queries[0]?.queryKey).toContain(CONNECTED_CHAIN_ID);
  });

  it('stays disabled when an explicit chain differs from the connected chain', () => {
    renderToString(<Probe chainId={OTHER_CHAIN_ID} />);

    expect(mocks.tokensChainId).toBe(OTHER_CHAIN_ID);
    expect(mocks.queries).toHaveLength(1);
    expect(mocks.queries[0]?.enabled).toBe(false);
    expect(mocks.queries[0]?.queryKey).toContain(OTHER_CHAIN_ID);
    expect(mocks.queries[0]?.queryKey).not.toContain(CONNECTED_CHAIN_ID);
  });

  it('respects enabled: false on the connected chain', () => {
    renderToString(<Probe chainId={CONNECTED_CHAIN_ID} enabled={false} />);

    expect(mocks.queries[0]?.enabled).toBe(false);
  });
});
