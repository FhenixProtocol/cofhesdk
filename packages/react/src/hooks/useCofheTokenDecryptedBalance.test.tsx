import { renderToString } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';

import type { ConfidentialToken } from '@/types/token';

type ReadAndDecryptOptions = {
  readQueryOptions?: Record<string, unknown>;
  decryptingQueryOptions?: Record<string, unknown>;
  meta?: Record<string, unknown>;
};

const mocks = vi.hoisted(() => ({ options: undefined as ReadAndDecryptOptions | undefined }));

vi.mock('./useCofheReadContractAndDecrypt', () => ({
  useCofheReadContractAndDecrypt: (_params: unknown, options: ReadAndDecryptOptions) => {
    mocks.options = options;
    return {
      decrypted: { data: undefined, isFetching: false },
      encrypted: { isFetching: false, refetch: async () => undefined },
      disabledDueToMissingValidACP: false,
      isReadError: false,
      isDecryptError: false,
      isValueStale: false,
      isKnownZero: false,
      isOutOfScope: false,
    };
  },
}));

vi.mock('./useCofheACPScope', () => ({
  useCofheEffectiveACP: () => ({ scoped: false, issuer: undefined }),
}));

import { useCofheTokenDecryptedBalance } from './useCofheTokenDecryptedBalance';

const token: ConfidentialToken = {
  chainId: 84532,
  address: '0x3Cdcdd0EB7311a59fDe92D44B01165B2Ca2019C4',
  name: 'fhETH',
  symbol: 'fhETH',
  decimals: 6,
  extensions: { fhenix: { confidentialityType: 'wrappedNative', confidentialValueType: 'uint64' } },
};

function Probe() {
  useCofheTokenDecryptedBalance(
    { token, accountAddress: '0x0000000000000000000000000000000000000001', meta: { label: 'savings' } },
    { refetchInterval: 5_000, staleTime: 30_000, retry: false, meta: { origin: 'app' } }
  );
  return null;
}

describe('useCofheTokenDecryptedBalance', () => {
  it('passes query options to the decrypt query', () => {
    renderToString(<Probe />);
    const decrypting = mocks.options!.decryptingQueryOptions!;

    expect(decrypting.refetchInterval).toBe(5_000);
    expect(decrypting.staleTime).toBe(30_000);
    expect(decrypting.retry).toBe(false);
    expect(decrypting.meta).toEqual({ origin: 'app' });
    expect(decrypting.select).toBeTypeOf('function');
  });

  it('keeps the decrypt meta label when query meta is passed', () => {
    renderToString(<Probe />);

    expect(mocks.options!.meta).toEqual({ label: 'savings' });
  });

  it('keeps the decrypt query free of options meant for the read', () => {
    renderToString(<Probe />);

    expect(mocks.options!.decryptingQueryOptions).not.toHaveProperty('readQueryOptions');
    expect(mocks.options!.readQueryOptions).toEqual({ refetchOnMount: false, enabled: true });
  });

  it('passes readQueryOptions to the ciphertext read and keeps its own gating', () => {
    function ReadProbe() {
      useCofheTokenDecryptedBalance(
        { token, accountAddress: '0x0000000000000000000000000000000000000001' },
        { enabled: false, readQueryOptions: { refetchInterval: 30_000, refetchOnMount: true, staleTime: 1_000 } }
      );
      return null;
    }
    renderToString(<ReadProbe />);
    const read = mocks.options!.readQueryOptions!;

    expect(read.refetchInterval).toBe(30_000);
    expect(read.staleTime).toBe(1_000);
    expect(read.refetchOnMount).toBe(true);
    expect(read.enabled).toBe(false);
    expect(mocks.options!.decryptingQueryOptions!.refetchInterval).toBeUndefined();
  });
});
