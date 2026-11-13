import { renderToString } from 'react-dom/server';
import type { ACP } from '@cofhe/sdk/acps';
import { afterEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  chainId: 11155111,
  activeACP: undefined as ACP | undefined,
  useInternalQuery: vi.fn((_options: { queryKey: readonly unknown[]; enabled?: boolean }) => ({
    data: 'valid' as string | undefined,
    dataUpdatedAt: 1,
    errorUpdatedAt: 0,
  })),
}));

vi.mock('@/providers', () => ({
  useCofheContext: () => ({ client: { acp: { checkAccess: vi.fn() } } }),
  useInternalQuery: mocks.useInternalQuery,
}));

vi.mock('./useCofheACPs', () => ({
  useCofheACP: () => undefined,
  useCofheActiveACP: () =>
    mocks.activeACP
      ? { acp: mocks.activeACP, isValid: true, hash: mocks.activeACP.hash }
      : undefined,
}));

vi.mock('./useCofheConnection', () => ({
  useCofheConnection: () => ({ connected: true, chainId: mocks.chainId }),
}));

vi.mock('@cofhe/sdk/acps', () => ({
  ACPScope: { Handles: 0 },
  ACPUtils: {
    isExpired: () => false,
    isValid: () => ({ valid: true }),
  },
}));

import { ACP_STATUS_QUERY_KEY, useCofheACPStatus, useCofheEffectiveACP } from './useCofheACPScope';

const ACP_HASH = '0x1234';
const ACTIVE_HASH = '0xabcd';
const TEST_ACP = {
  hash: ACP_HASH,
  issuer: '0x0000000000000000000000000000000000000001',
} as unknown as ACP;
const ACTIVE_ACP = {
  hash: ACTIVE_HASH,
  issuer: '0x0000000000000000000000000000000000000002',
  type: 'recipient',
} as unknown as ACP;

function StatusProbe({ chainId }: { chainId?: number }) {
  return <output>{useCofheACPStatus(TEST_ACP, chainId).status}</output>;
}

function EffectiveActiveProbe() {
  const effective = useCofheEffectiveACP({});
  // Single text node — renderToString otherwise injects <!-- --> between adjacent expressions.
  return (
    <output>{`${effective.status}:${effective.isValid ? 'yes' : 'no'}:${effective.scoped ? 'scoped' : 'active'}`}</output>
  );
}

describe('useCofheACPStatus', () => {
  afterEach(() => {
    mocks.chainId = 11155111;
    mocks.activeACP = undefined;
    mocks.useInternalQuery.mockClear();
  });

  it('isolates cached status by connected chain', () => {
    renderToString(<StatusProbe />);
    mocks.chainId = 84532;
    renderToString(<StatusProbe />);

    expect(mocks.useInternalQuery.mock.calls.map(([options]) => options.queryKey)).toEqual([
      [ACP_STATUS_QUERY_KEY, ACP_HASH, 11155111],
      [ACP_STATUS_QUERY_KEY, ACP_HASH, 84532],
    ]);
  });

  it('uses an explicitly requested chain in the cache key', () => {
    renderToString(<StatusProbe chainId={84532} />);

    expect(mocks.useInternalQuery).toHaveBeenCalledWith(
      expect.objectContaining({ queryKey: [ACP_STATUS_QUERY_KEY, ACP_HASH, 84532] })
    );
  });
});

describe('useCofheEffectiveACP (active path)', () => {
  afterEach(() => {
    mocks.chainId = 11155111;
    mocks.activeACP = undefined;
    mocks.useInternalQuery.mockClear();
  });

  it('checks the active ACP on chain the same way a scoped ACP is checked', () => {
    mocks.activeACP = ACTIVE_ACP;

    const html = renderToString(<EffectiveActiveProbe />);

    expect(html).toContain('valid:yes:active');
    // Two status hooks always run (option + active). The option path is disabled (no acp);
    // the active path must enable checkAccess for the active hash.
    expect(mocks.useInternalQuery).toHaveBeenCalledWith(
      expect.objectContaining({
        queryKey: [ACP_STATUS_QUERY_KEY, ACTIVE_HASH, 11155111],
        enabled: true,
      })
    );
  });

  it('reports revoked when the on-chain check says so', () => {
    mocks.activeACP = ACTIVE_ACP;
    mocks.useInternalQuery.mockReturnValue({
      data: 'revoked',
      dataUpdatedAt: 1,
      errorUpdatedAt: 0,
    });

    const html = renderToString(<EffectiveActiveProbe />);

    expect(html).toContain('revoked:no:active');
  });
});
