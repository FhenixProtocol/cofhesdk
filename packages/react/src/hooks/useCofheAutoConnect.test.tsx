// @vitest-environment happy-dom

import { QueryClient } from '@tanstack/react-query';
import { baseSepolia, sepolia } from '@cofhe/sdk/chains';
import { createCofheClient } from '@cofhe/sdk/web';
import type { PublicClient, WalletClient } from 'viem';
import * as ReactExports from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { createCofheConfig } from '../config';
import { CofheProvider } from '../providers/CofheProvider';

const { act } = ReactExports as typeof ReactExports & { act: typeof import('react-dom/test-utils').act };

const ACCOUNT_A = '0x0000000000000000000000000000000000000001';
const ACCOUNT_B = '0x0000000000000000000000000000000000000002';

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason: Error) => void;
  const promise = new Promise<T>((resolvePromise, rejectPromise) => {
    resolve = resolvePromise;
    reject = rejectPromise;
  });
  return { promise, resolve, reject };
}

// `connect` reads the chain id from the public client; a deferred one keeps an attempt in flight.
function publicClient(chainId: number | Promise<number>) {
  return {
    request: vi.fn(),
    readContract: vi.fn(),
    getChainId: vi.fn(() => Promise.resolve(chainId)),
  } as unknown as PublicClient & { getChainId: ReturnType<typeof vi.fn> };
}

function walletClient(chainId: number, account: `0x${string}`) {
  return {
    chain: { id: chainId },
    account: { address: account, type: 'json-rpc' },
    request: vi.fn(),
    sendTransaction: vi.fn(),
  } as unknown as WalletClient;
}

describe('useCofheAutoConnect through CofheProvider', () => {
  let container: HTMLDivElement;
  let root: Root;
  let client: ReturnType<typeof createClient>;
  let queryClient: QueryClient;

  function createClient() {
    return createCofheClient(createCofheConfig({ supportedChains: [sepolia, baseSepolia], fheKeyStorage: null }));
  }

  async function render(publicClient?: PublicClient, walletClient?: WalletClient) {
    await act(async () => {
      root.render(
        <CofheProvider
          cofheClient={client}
          queryClient={queryClient}
          publicClient={publicClient}
          walletClient={walletClient}
        >
          {null}
        </CofheProvider>
      );
    });
  }

  function expectConnection(publicClient: PublicClient, walletClient: WalletClient, account: `0x${string}`) {
    expect(client.getSnapshot()).toMatchObject({
      connected: true,
      connecting: false,
      connectError: undefined,
      chainId: walletClient.chain?.id,
      account,
    });
    expect(client.connection.publicClient).toBe(publicClient);
    expect(client.connection.walletClient).toBe(walletClient);
  }

  function expectDisconnected() {
    expect(client.getSnapshot()).toMatchObject({
      connected: false,
      connecting: false,
      connectError: undefined,
      chainId: undefined,
      account: undefined,
      publicClient: undefined,
      walletClient: undefined,
    });
  }

  beforeEach(() => {
    vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
    client = createClient();
    queryClient = new QueryClient({ defaultOptions: { mutations: { retry: false, gcTime: 0 } } });
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(() => {
    act(() => root.unmount());
    client.disconnect();
    queryClient.clear();
    container.remove();
    vi.unstubAllGlobals();
  });

  it('keeps the newer chain connected when the older attempt finishes last', async () => {
    const firstChainId = deferred<number>();
    const firstPublicClient = publicClient(firstChainId.promise);
    const firstWalletClient = walletClient(sepolia.id, ACCOUNT_A);

    await render(firstPublicClient, firstWalletClient);
    expect(firstPublicClient.getChainId).toHaveBeenCalledOnce();
    expect(client.connecting).toBe(true);

    const nextPublicClient = publicClient(baseSepolia.id);
    const nextWalletClient = walletClient(baseSepolia.id, ACCOUNT_B);
    await render(nextPublicClient, nextWalletClient);
    expectConnection(nextPublicClient, nextWalletClient, ACCOUNT_B);

    await act(async () => firstChainId.resolve(sepolia.id));
    expectConnection(nextPublicClient, nextWalletClient, ACCOUNT_B);
  });

  it('follows an account-only switch with the same public client and chain', async () => {
    const firstChainId = deferred<number>();
    const sharedPublicClient = publicClient(sepolia.id);
    sharedPublicClient.getChainId.mockReturnValueOnce(firstChainId.promise);
    const firstWalletClient = walletClient(sepolia.id, ACCOUNT_A);

    await render(sharedPublicClient, firstWalletClient);
    expect(sharedPublicClient.getChainId).toHaveBeenCalledOnce();
    expect(client.connecting).toBe(true);

    const nextWalletClient = walletClient(sepolia.id, ACCOUNT_B);
    await render(sharedPublicClient, nextWalletClient);
    expectConnection(sharedPublicClient, nextWalletClient, ACCOUNT_B);

    await act(async () => firstChainId.resolve(sepolia.id));
    expectConnection(sharedPublicClient, nextWalletClient, ACCOUNT_B);
  });

  it('stays disconnected when clients disappear during an in-flight connection', async () => {
    const chainId = deferred<number>();
    const firstPublicClient = publicClient(chainId.promise);

    await render(firstPublicClient, walletClient(sepolia.id, ACCOUNT_A));
    expect(firstPublicClient.getChainId).toHaveBeenCalledOnce();
    expect(client.connecting).toBe(true);

    await render();
    expectDisconnected();

    await act(async () => chainId.resolve(sepolia.id));
    expectDisconnected();
  });

  it('stays disconnected after switching to an unsupported chain while connecting', async () => {
    const chainId = deferred<number>();
    const firstPublicClient = publicClient(chainId.promise);

    await render(firstPublicClient, walletClient(sepolia.id, ACCOUNT_A));
    expect(firstPublicClient.getChainId).toHaveBeenCalledOnce();
    expect(client.connecting).toBe(true);

    const unsupportedPublicClient = publicClient(999);
    await render(unsupportedPublicClient, walletClient(999, ACCOUNT_B));
    expect(unsupportedPublicClient.getChainId).not.toHaveBeenCalled();
    expectDisconnected();

    await act(async () => chainId.resolve(sepolia.id));
    expectDisconnected();
  });

  it('does not let a late failure from the older attempt clear a newer connection', async () => {
    const firstChainId = deferred<number>();
    const firstPublicClient = publicClient(firstChainId.promise);

    await render(firstPublicClient, walletClient(sepolia.id, ACCOUNT_A));
    expect(firstPublicClient.getChainId).toHaveBeenCalledOnce();
    expect(client.connecting).toBe(true);

    const nextPublicClient = publicClient(baseSepolia.id);
    const nextWalletClient = walletClient(baseSepolia.id, ACCOUNT_B);
    await render(nextPublicClient, nextWalletClient);
    expectConnection(nextPublicClient, nextWalletClient, ACCOUNT_B);

    await act(async () => firstChainId.reject(new Error('Old wallet disconnected')));
    expectConnection(nextPublicClient, nextWalletClient, ACCOUNT_B);
  });
});
