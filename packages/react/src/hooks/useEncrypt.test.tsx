import { renderHook, act } from '@testing-library/react';
import {
  CONNECT_STORE_DEFAULTS,
  Encryptable,
  FheTypes,
  type CofhesdkClient,
  type CofhesdkClientConnectionState,
  type EncryptableItem,
  type EncryptedItemInput,
} from '@cofhe/sdk';
import type { ReactNode } from 'react';
import { describe, it, expect, vi, afterEach } from 'vitest';
import { CofheProvider } from '../providers/CofheProvider.js';
import { useEncrypt } from './useEncrypt.js';

const createAbortError = () => {
  const error = new Error('Encryption aborted');
  error.name = 'AbortError';
  return error;
};

class MockEncryptInputsBuilder {
  private abortSignal: AbortSignal | null = null;

  constructor(private readonly inputs: readonly EncryptableItem[]) {}

  setStepCallback() {
    return this;
  }

  setAccount() {
    return this;
  }

  setChainId() {
    return this;
  }

  setSecurityZone() {
    return this;
  }

  setAbortSignal(signal?: AbortSignal) {
    this.abortSignal = signal ?? null;
    return this;
  }

  encrypt(): Promise<{ success: true; data: EncryptedItemInput[]; error: null }> {
    return new Promise((resolve, reject) => {
      let timer: ReturnType<typeof setTimeout>;

      const handleAbort = () => {
        clearTimeout(timer);
        this.abortSignal?.removeEventListener('abort', handleAbort);
        reject(createAbortError());
      };

      if (this.abortSignal?.aborted) {
        handleAbort();
        return;
      }

      this.abortSignal?.addEventListener('abort', handleAbort, { once: true });

      timer = setTimeout(() => {
        this.abortSignal?.removeEventListener('abort', handleAbort);
        resolve({
          success: true,
          data: this.inputs.map(() => ({
            ctHash: 1n,
            securityZone: 0,
            utype: FheTypes.Int12,
            signature: '0x',
          })),
          error: null,
        });
      }, 50);
    });
  }
}

const createMockClient = (): CofhesdkClient => {
  const connectionState: CofhesdkClientConnectionState = { ...CONNECT_STORE_DEFAULTS };

  return {
    encryptInputs: (inputs: readonly EncryptableItem[]) =>
      new MockEncryptInputsBuilder(inputs) as unknown as ReturnType<CofhesdkClient['encryptInputs']>,
    subscribe: () => () => {},
    getSnapshot: () => connectionState,
  } as unknown as CofhesdkClient;
};

const withProvider =
  (client: CofhesdkClient) =>
  ({ children }: { children: ReactNode }) => <CofheProvider client={client}>{children}</CofheProvider>;

describe('useEncrypt cancellation', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it('aborts previous encryption when a new request starts', async () => {
    vi.useFakeTimers();
    const mockClient = createMockClient();
    const wrapper = withProvider(mockClient);

    const { result } = renderHook(() => useEncrypt(), { wrapper });

    let firstPromise: Promise<unknown> | undefined;
    let secondPromise: Promise<unknown> | undefined;

    await act(async () => {
      firstPromise = result.current.encrypt({ input: Encryptable.uint8(1n) });
      firstPromise.catch(() => {});
      secondPromise = result.current.encrypt({ input: Encryptable.uint8(2n) });
    });

    expect(firstPromise).toBeDefined();
    expect(secondPromise).toBeDefined();

    await expect(firstPromise!).rejects.toMatchObject({ name: 'AbortError' });

    await act(async () => {
      await vi.advanceTimersByTimeAsync(100);
    });

    await expect(secondPromise!).resolves.toHaveProperty('ctHash');
  });
});
