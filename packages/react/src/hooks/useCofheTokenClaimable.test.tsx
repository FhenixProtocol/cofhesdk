import { QueryClient } from '@tanstack/react-query';
import { renderToString } from 'react-dom/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  constructUnshieldClaimsQueryKey,
  constructUnshieldClaimsQueryKeyForInvalidation,
  constructUnshieldClaimsSummaryQueryKey,
  useCofheTokenClaimable,
  useCofheTokenClaims,
} from './useCofheTokenClaimable';
import type { ConfidentialToken } from './useCofheTokenLists';
import { useCofheTokensClaimable } from './useCofheTokensClaimable';

const state = vi.hoisted(() => ({
  queryOptions: undefined as Record<string, unknown> | undefined,
  queries: undefined as Record<string, unknown>[] | undefined,
  publicClient: undefined as object | undefined,
  activeACPHash: undefined as string | undefined,
}));

vi.mock('@/providers', () => ({
  useInternalQuery: (options: Record<string, unknown>) => {
    state.queryOptions = options;
    return {};
  },
  useInternalQueries: (options: { queries: Record<string, unknown>[] }) => {
    state.queries = options.queries;
    return {
      summariesByTokenAddress: {},
      claimableByTokenAddress: {},
      totalTokensClaimable: 0,
      queries: [],
      isLoading: false,
      isFetching: false,
      isError: false,
      error: null,
    };
  },
}));

vi.mock('./useCofheConnection', () => ({
  useCofhePublicClient: () => state.publicClient,
  useCofheChainId: () => 11155111,
}));

vi.mock('./useCofheClient', () => ({
  useCofheClient: () => ({}),
}));

vi.mock('./useCofheACPs', () => ({
  useCofheActiveACPHash: () => state.activeACPHash,
}));

vi.mock('./useStoredTransactions', () => ({
  useStoredTransactions: () => ({ reduced: {} }),
}));

const ACCOUNT = '0x0000000000000000000000000000000000000002' as const;

const TOKEN = {
  chainId: 11155111,
  address: '0x0000000000000000000000000000000000000003',
  extensions: { fhenix: { confidentialityType: 'dual' } },
} as unknown as ConfidentialToken;

type ProbeProps = { account?: `0x${string}`; enabled?: boolean };

function ClaimableProbe({ account, enabled }: ProbeProps) {
  useCofheTokenClaimable({ token: TOKEN, accountAddress: account }, enabled === undefined ? undefined : { enabled });
  return null;
}

function ClaimsProbe({ account, enabled }: ProbeProps) {
  useCofheTokenClaims({ token: TOKEN, accountAddress: account }, enabled === undefined ? undefined : { enabled });
  return null;
}

function ClaimsManyProbe() {
  useCofheTokensClaimable({ tokens: [TOKEN], accountAddress: ACCOUNT });
  return null;
}

describe.each([
  ['useCofheTokenClaimable', ClaimableProbe],
  ['useCofheTokenClaims', ClaimsProbe],
])('%s', (_name, Probe) => {
  beforeEach(() => {
    state.queryOptions = undefined;
    state.queries = undefined;
    state.publicClient = {};
    state.activeACPHash = undefined;
  });

  it('stays disabled without an account when enabled: true is passed', () => {
    renderToString(<Probe enabled />);

    expect(state.queryOptions?.enabled).toBe(false);
  });

  it('stays disabled without a public client when enabled: true is passed', () => {
    state.publicClient = undefined;
    renderToString(<Probe account={ACCOUNT} enabled />);

    expect(state.queryOptions?.enabled).toBe(false);
  });

  it('respects enabled: false', () => {
    renderToString(<Probe account={ACCOUNT} enabled={false} />);

    expect(state.queryOptions?.enabled).toBe(false);
  });

  it('is enabled with an account, a public client and a claimable token', () => {
    renderToString(<Probe account={ACCOUNT} />);

    expect(state.queryOptions?.enabled).toBe(true);
  });
});

describe('ACP-aware claim summary cache identity', () => {
  beforeEach(() => {
    state.queryOptions = undefined;
    state.queries = undefined;
    state.publicClient = {};
    state.activeACPHash = undefined;
  });

  it('separates summaries decrypted with different active ACPs', () => {
    const first = constructUnshieldClaimsSummaryQueryKey({
      chainId: TOKEN.chainId,
      tokenAddress: TOKEN.address,
      confidentialityType: TOKEN.extensions.fhenix.confidentialityType,
      accountAddress: ACCOUNT,
      activeACPHash: '0xaaa',
    });
    const second = constructUnshieldClaimsSummaryQueryKey({
      chainId: TOKEN.chainId,
      tokenAddress: TOKEN.address,
      confidentialityType: TOKEN.extensions.fhenix.confidentialityType,
      accountAddress: ACCOUNT,
      activeACPHash: '0xbbb',
    });

    expect(first).not.toEqual(second);
    expect(first).toEqual([
      'unshieldClaims',
      TOKEN.chainId,
      TOKEN.address,
      TOKEN.extensions.fhenix.confidentialityType,
      ACCOUNT,
      'summary',
      '0xaaa',
    ]);
  });

  it('updates the single-token summary key when the active ACP changes', () => {
    state.activeACPHash = '0xaaa';
    renderToString(<ClaimableProbe account={ACCOUNT} />);
    const first = state.queryOptions?.queryKey;

    state.activeACPHash = '0xbbb';
    renderToString(<ClaimableProbe account={ACCOUNT} />);

    expect(state.queryOptions?.queryKey).not.toEqual(first);
  });

  it('updates every multi-token summary key when the active ACP changes', () => {
    state.activeACPHash = '0xaaa';
    renderToString(<ClaimsManyProbe />);
    const first = state.queries?.[0]?.queryKey;

    state.activeACPHash = '0xbbb';
    renderToString(<ClaimsManyProbe />);

    expect(state.queries?.[0]?.queryKey).not.toEqual(first);
  });

  it('keeps the raw claim list independent of the active ACP', () => {
    state.activeACPHash = '0xaaa';
    renderToString(<ClaimsProbe account={ACCOUNT} />);
    const first = state.queryOptions?.queryKey;

    state.activeACPHash = '0xbbb';
    renderToString(<ClaimsProbe account={ACCOUNT} />);

    expect(state.queryOptions?.queryKey).toEqual(first);
  });

  it('invalidates every ACP-specific summary through the existing base key', async () => {
    const queryClient = new QueryClient();
    const baseParams = {
      chainId: TOKEN.chainId,
      tokenAddress: TOKEN.address,
      confidentialityType: TOKEN.extensions.fhenix.confidentialityType,
      accountAddress: ACCOUNT,
    };
    const first = constructUnshieldClaimsSummaryQueryKey({ ...baseParams, activeACPHash: '0xaaa' });
    const second = constructUnshieldClaimsSummaryQueryKey({ ...baseParams, activeACPHash: '0xbbb' });
    const list = [...constructUnshieldClaimsQueryKey(baseParams), 'list'] as const;

    queryClient.setQueryData(first, {});
    queryClient.setQueryData(second, {});
    queryClient.setQueryData(list, []);

    await queryClient.invalidateQueries({
      queryKey: constructUnshieldClaimsQueryKeyForInvalidation({
        chainId: TOKEN.chainId,
        tokenAddress: TOKEN.address,
        confidentialityType: TOKEN.extensions.fhenix.confidentialityType,
        accountAddress: ACCOUNT,
      }),
    });

    expect(queryClient.getQueryState(first)?.isInvalidated).toBe(true);
    expect(queryClient.getQueryState(second)?.isInvalidated).toBe(true);
    expect(queryClient.getQueryState(list)?.isInvalidated).toBe(true);
  });
});
