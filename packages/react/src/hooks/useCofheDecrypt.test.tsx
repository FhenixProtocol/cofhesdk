import { renderToString } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import { FheTypes } from '@cofhe/sdk';
import { useCofheDecrypt } from './useCofheDecrypt';

const state = vi.hoisted(() => ({ queryOptions: undefined as Record<string, unknown> | undefined }));

vi.mock('@/providers', () => ({
  useCofheContext: () => ({ client: {} }),
  useInternalQuery: (options: Record<string, unknown>) => {
    state.queryOptions = options;
    return {};
  },
}));

vi.mock('./useCofheACPs', () => ({
  useCofheActiveACP: () => ({ isValid: true }),
}));

function Probe({ retry }: { retry?: false }) {
  useCofheDecrypt({ input: { ctHash: '42', utype: FheTypes.Uint8 } }, retry === undefined ? undefined : { retry });
  return null;
}

describe('useCofheDecrypt', () => {
  it('preserves an explicit retry=false option', () => {
    renderToString(<Probe retry={false} />);

    expect(state.queryOptions?.retry).toBe(false);
  });

  it('keeps the default three-retry policy when none is provided', () => {
    renderToString(<Probe />);

    const retry = state.queryOptions?.retry as (failureCount: number, error: Error) => boolean;
    expect(retry(0, new Error('temporary'))).toBe(true);
    expect(retry(3, new Error('temporary'))).toBe(false);
  });
});
