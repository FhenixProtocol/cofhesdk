import { renderToString } from 'react-dom/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useCofheTokenClaimable, useCofheTokenClaims } from './useCofheTokenClaimable';
import type { ConfidentialToken } from './useCofheTokenLists';

const state = vi.hoisted(() => ({
  queryOptions: undefined as Record<string, unknown> | undefined,
  publicClient: undefined as object | undefined,
}));

vi.mock('@/providers', () => ({
  useInternalQuery: (options: Record<string, unknown>) => {
    state.queryOptions = options;
    return {};
  },
}));

vi.mock('./useCofheConnection', () => ({
  useCofhePublicClient: () => state.publicClient,
  useCofheChainId: () => 11155111,
}));

vi.mock('./useCofheClient', () => ({
  useCofheClient: () => ({}),
}));

const ACCOUNT = '0x0000000000000000000000000000000000000002';

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

describe.each([
  ['useCofheTokenClaimable', ClaimableProbe],
  ['useCofheTokenClaims', ClaimsProbe],
])('%s', (_name, Probe) => {
  beforeEach(() => {
    state.queryOptions = undefined;
    state.publicClient = {};
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
