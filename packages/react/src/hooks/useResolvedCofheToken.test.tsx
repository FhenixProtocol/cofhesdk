import { renderToString } from 'react-dom/server';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { TOKEN_CONFIDENTIALITY_TYPE_INTERFACE_IDS } from '@/constants/tokenTypeConfig';
import { getConfidentialDecimals, getPublicDecimals, type ConfidentialToken } from '@/types/token';

const TOKEN = '0x5Be13CCbcc3b93579d49d682E58c207Df615e963';

type Call = { functionName: string; args?: readonly unknown[] };

const mocks = vi.hoisted(() => ({
  queryFn: undefined as (() => Promise<ConfidentialToken | undefined>) | undefined,
  supportedInterfaces: [] as readonly string[],
  readContract: vi.fn(async ({ functionName }: Call) => {
    if (functionName === 'confidentialDecimals') return 6;
    throw new Error(`unexpected read: ${functionName}`);
  }),
}));

const publicClient = {
  multicall: vi.fn(async ({ contracts }: { contracts: Call[] }) =>
    contracts.map((c) => {
      switch (c.functionName) {
        case 'decimals':
          return { status: 'success', result: 18 };
        case 'symbol':
          return { status: 'success', result: 'cUSD18' };
        case 'name':
          return { status: 'success', result: 'Dual cUSD18' };
        case 'supportsInterface':
          return { status: 'success', result: mocks.supportedInterfaces.includes(c.args?.[0] as string) };
        default:
          return { status: 'failure', error: new Error('reverted') };
      }
    })
  ),
  readContract: mocks.readContract,
};

vi.mock('@/providers', () => ({
  useInternalQuery: (options: { queryFn: () => Promise<ConfidentialToken | undefined> }) => {
    mocks.queryFn = options.queryFn;
    return {};
  },
}));

vi.mock('./useCofheConnection', () => ({
  useCofhePublicClient: () => publicClient,
  useCofheChainId: () => 84532,
}));

import { useResolvedCofheToken } from './useResolvedCofheToken';

function Probe() {
  useResolvedCofheToken({ address: TOKEN });
  return null;
}

async function resolve(supportedInterfaces: readonly string[]) {
  mocks.supportedInterfaces = supportedInterfaces;
  renderToString(<Probe />);
  return mocks.queryFn!();
}

describe('useResolvedCofheToken', () => {
  afterEach(() => {
    mocks.readContract.mockClear();
  });

  it('reads confidentialDecimals for dual tokens', async () => {
    const token = await resolve(TOKEN_CONFIDENTIALITY_TYPE_INTERFACE_IDS.dual!);

    expect(token?.extensions.fhenix.confidentialityType).toBe('dual');
    expect(getPublicDecimals(token!)).toBe(18);
    expect(getConfidentialDecimals(token!)).toBe(6);
  });

  it('does not query confidentialDecimals for other token types', async () => {
    const token = await resolve(TOKEN_CONFIDENTIALITY_TYPE_INTERFACE_IDS.wrappedErc20!);

    expect(token?.extensions.fhenix.confidentialityType).toBe('wrappedErc20');
    expect(token?.extensions.fhenix.confidentialDecimals).toBeUndefined();
    expect(mocks.readContract).not.toHaveBeenCalled();
  });
});
