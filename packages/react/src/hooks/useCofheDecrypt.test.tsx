import { renderToString } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import { CofheError, CofheErrorCode, FheTypes } from '@cofhe/sdk';
import { useCofheDecrypt } from './useCofheDecrypt';

type RetryOption = boolean | number | ((failureCount: number, error: Error) => boolean);

const state = vi.hoisted(() => ({ queryOptions: undefined as Record<string, unknown> | undefined }));

vi.mock('@/providers', () => ({
  useCofheContext: () => ({ client: {} }),
  useInternalQueryClient: () => ({}),
  useInternalQuery: (options: Record<string, unknown>) => {
    state.queryOptions = options;
    return {};
  },
}));

vi.mock('@/providers/acpDecryptCache', () => ({
  removeDecryptsOfACPs: vi.fn(),
}));

vi.mock('./useCofheACPScope', () => ({
  useCofheEffectiveACP: () => ({ acp: { hash: '0x1', type: 'self' }, isValid: true, scoped: false }),
  isHandleOutOfScope: () => false,
}));

vi.mock('./useCofheConnection', () => ({
  useCofheChainId: () => 11155111,
}));

function Probe({ retry }: { retry?: RetryOption }) {
  useCofheDecrypt({ input: { ctHash: '42', utype: FheTypes.Uint8 } }, retry === undefined ? undefined : { retry });
  return null;
}

describe('useCofheDecrypt', () => {
  it('preserves an explicit retry=false option', () => {
    renderToString(<Probe retry={false} />);

    expect(state.queryOptions?.retry).toBe(false);
  });

  it('preserves a custom retry function', () => {
    const retry = (failureCount: number) => failureCount < 5;
    renderToString(<Probe retry={retry} />);

    expect(state.queryOptions?.retry).toBe(retry);
  });

  it('keeps the default policy when none is provided: 3 retries, none for CofheError', () => {
    renderToString(<Probe />);

    const retry = state.queryOptions?.retry as (failureCount: number, error: Error) => boolean;
    expect(retry(0, new Error('temporary'))).toBe(true);
    expect(retry(3, new Error('temporary'))).toBe(false);
    expect(retry(0, new CofheError({ code: CofheErrorCode.InternalError, message: 'decrypt failed' }))).toBe(false);
  });
});
