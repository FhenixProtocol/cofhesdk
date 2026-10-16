import { renderToString } from 'react-dom/server';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { TOKEN_CONFIDENTIALITY_TYPE_INTERFACE_IDS } from '@/constants/tokenTypeConfig';
import { getConfidentialDecimals, getPublicDecimals, type ConfidentialToken } from '@/types/token';

const TOKEN = '0x5Be13CCbcc3b93579d49d682E58c207Df615e963';

type Call = { functionName: string; args?: readonly unknown[] };

const mocks = vi.hoisted(() => ({
  queryOptions: undefined as { enabled?: boolean; queryFn: () => Promise<ConfidentialToken | undefined> } | undefined,
  publicClient: undefined as object | undefined,
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
  useInternalQuery: (options: NonNullable<typeof mocks.queryOptions>) => {
    mocks.queryOptions = options;
    return {};
  },
}));

vi.mock('./useCofheConnection', () => ({
  useCofhePublicClient: () => mocks.publicClient,
  useCofheChainId: () => 84532,
}));

import { useResolvedCofheToken } from './useResolvedCofheToken';

function Probe({ enabled }: { enabled?: boolean }) {
  useResolvedCofheToken({ address: TOKEN }, enabled === undefined ? undefined : { enabled });
  return null;
}

async function resolve(supportedInterfaces: readonly string[]) {
  mocks.supportedInterfaces = supportedInterfaces;
  renderToString(<Probe />);
  return mocks.queryOptions!.queryFn();
}

describe('useResolvedCofheToken', () => {
  beforeEach(() => {
    mocks.queryOptions = undefined;
    mocks.publicClient = publicClient;
  });

  afterEach(() => {
    mocks.readContract.mockClear();
  });

  describe('enabled gate', () => {
    it('stays disabled without a public client when enabled: true is passed', () => {
      mocks.publicClient = undefined;
      renderToString(<Probe enabled />);

      expect(mocks.queryOptions?.enabled).toBe(false);
    });

    it('respects enabled: false', () => {
      renderToString(<Probe enabled={false} />);

      expect(mocks.queryOptions?.enabled).toBe(false);
    });

    it('is enabled with a public client, a chain and an address', () => {
      renderToString(<Probe enabled />);

      expect(mocks.queryOptions?.enabled).toBe(true);
    });
  });

  describe('decimals', () => {
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
});
