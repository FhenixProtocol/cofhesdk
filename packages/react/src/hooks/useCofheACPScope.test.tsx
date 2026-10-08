import { renderToString } from 'react-dom/server';
import type { ACP } from '@cofhe/sdk/acps';
import { afterEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  chainId: 11155111,
  useInternalQuery: vi.fn((_options: { queryKey: readonly unknown[] }) => ({
    data: 'valid',
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
  useCofheActiveACP: () => undefined,
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

import { ACP_STATUS_QUERY_KEY, useCofheACPStatus } from './useCofheACPScope';

const ACP_HASH = '0x1234';
const TEST_ACP = {
  hash: ACP_HASH,
  issuer: '0x0000000000000000000000000000000000000001',
} as unknown as ACP;

function StatusProbe({ chainId }: { chainId?: number }) {
  return <output>{useCofheACPStatus(TEST_ACP, chainId).status}</output>;
}

describe('useCofheACPStatus', () => {
  afterEach(() => {
    mocks.chainId = 11155111;
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
