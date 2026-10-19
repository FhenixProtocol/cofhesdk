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

function publicClient(chainId: number) {
  return {
    chain: { id: chainId },
    request: vi.fn(),
    readContract: vi.fn(),
  } as unknown as PublicClient;
}

function walletClient(chainId: number, addresses: Promise<`0x${string}`[]>) {
  return {
    chain: { id: chainId },
    request: vi.fn(),
    sendTransaction: vi.fn(),
    getAddresses: vi.fn(() => addresses),
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
      chainId: publicClient.chain!.id,
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
    const firstAddresses = deferred<`0x${string}`[]>();
    const firstPublicClient = publicClient(sepolia.id);
    const firstWalletClient = walletClient(sepolia.id, firstAddresses.promise);

    await render(firstPublicClient, firstWalletClient);
    expect(firstWalletClient.getAddresses).toHaveBeenCalledOnce();
    expect(client.connecting).toBe(true);

    const nextPublicClient = publicClient(baseSepolia.id);
    const nextWalletClient = walletClient(baseSepolia.id, Promise.resolve([ACCOUNT_B]));
    await render(nextPublicClient, nextWalletClient);
    expectConnection(nextPublicClient, nextWalletClient, ACCOUNT_B);

    await act(async () => firstAddresses.resolve([ACCOUNT_A]));
    expectConnection(nextPublicClient, nextWalletClient, ACCOUNT_B);
  });

  it('follows an account-only switch with the same public client and chain', async () => {
    const firstAddresses = deferred<`0x${string}`[]>();
    const sharedPublicClient = publicClient(sepolia.id);
    const firstWalletClient = walletClient(sepolia.id, firstAddresses.promise);

    await render(sharedPublicClient, firstWalletClient);
    expect(firstWalletClient.getAddresses).toHaveBeenCalledOnce();
    expect(client.connecting).toBe(true);

    const nextWalletClient = walletClient(sepolia.id, Promise.resolve([ACCOUNT_B]));
    await render(sharedPublicClient, nextWalletClient);
    expectConnection(sharedPublicClient, nextWalletClient, ACCOUNT_B);

    await act(async () => firstAddresses.resolve([ACCOUNT_A]));
    expectConnection(sharedPublicClient, nextWalletClient, ACCOUNT_B);
  });

  it('stays disconnected when clients disappear during an in-flight connection', async () => {
    const addresses = deferred<`0x${string}`[]>();
    const firstWalletClient = walletClient(sepolia.id, addresses.promise);

    await render(publicClient(sepolia.id), firstWalletClient);
    expect(firstWalletClient.getAddresses).toHaveBeenCalledOnce();
    expect(client.connecting).toBe(true);

    await render();
    expectDisconnected();

    await act(async () => addresses.resolve([ACCOUNT_A]));
    expectDisconnected();
  });

  it('stays disconnected after switching to an unsupported chain while connecting', async () => {
    const addresses = deferred<`0x${string}`[]>();
    const firstWalletClient = walletClient(sepolia.id, addresses.promise);

    await render(publicClient(sepolia.id), firstWalletClient);
    expect(firstWalletClient.getAddresses).toHaveBeenCalledOnce();
    expect(client.connecting).toBe(true);

    const unsupportedWalletClient = walletClient(999, Promise.resolve([ACCOUNT_B]));
    await render(publicClient(999), unsupportedWalletClient);
    expect(unsupportedWalletClient.getAddresses).not.toHaveBeenCalled();
    expectDisconnected();

    await act(async () => addresses.resolve([ACCOUNT_A]));
    expectDisconnected();
  });

  it('does not let a late failure from the older attempt clear a newer connection', async () => {
    const firstAddresses = deferred<`0x${string}`[]>();
    const firstWalletClient = walletClient(sepolia.id, firstAddresses.promise);

    await render(publicClient(sepolia.id), firstWalletClient);
    expect(firstWalletClient.getAddresses).toHaveBeenCalledOnce();
    expect(client.connecting).toBe(true);

    const nextPublicClient = publicClient(baseSepolia.id);
    const nextWalletClient = walletClient(baseSepolia.id, Promise.resolve([ACCOUNT_B]));
    await render(nextPublicClient, nextWalletClient);
    expectConnection(nextPublicClient, nextWalletClient, ACCOUNT_B);

    await act(async () => firstAddresses.reject(new Error('Old wallet disconnected')));
    expectConnection(nextPublicClient, nextWalletClient, ACCOUNT_B);
  });
});
