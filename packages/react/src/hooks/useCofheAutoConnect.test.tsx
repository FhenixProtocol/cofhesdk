// @vitest-environment happy-dom

import type { PublicClient, WalletClient } from 'viem';
import * as ReactExports from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const { act } = ReactExports as typeof ReactExports & { act: typeof import('react-dom/test-utils').act };
Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });

const mocks = vi.hoisted(() => ({
  client: {
    connected: false,
    connecting: false,
    config: { supportedChains: [{ id: 1 }, { id: 2 }] },
    disconnect: vi.fn(),
  },
  connect: vi.fn(),
}));

vi.mock('../utils/viemClientBridge', () => ({
  asCofhePublicClient: (client: unknown) => client,
  asCofheWalletClient: (client: unknown) => client,
}));

vi.mock('./useCofheClient', () => ({
  useCofheClient: () => mocks.client,
}));

vi.mock('./useCofheConnect', () => ({
  useCofheConnect: () => ({ mutate: mocks.connect }),
}));

import { useCofheAutoConnect } from './useCofheAutoConnect';

function publicClient(chainId: number) {
  return {
    chain: { id: chainId },
    request: vi.fn(),
    readContract: vi.fn(),
  } as unknown as PublicClient;
}

function walletClient(chainId: number) {
  return {
    chain: { id: chainId },
    request: vi.fn(),
    sendTransaction: vi.fn(),
  } as unknown as WalletClient;
}

function Probe({ publicClient, walletClient }: { publicClient: PublicClient; walletClient: WalletClient }) {
  useCofheAutoConnect({ publicClient, walletClient });
  return null;
}

describe('useCofheAutoConnect', () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    vi.clearAllMocks();
    mocks.client.connected = false;
    mocks.client.connecting = false;
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(() => {
    act(() => root.unmount());
    container.remove();
  });

  it('forwards a newer client pair while a previous connection is still pending', async () => {
    const firstPublicClient = publicClient(1);
    const firstWalletClient = walletClient(1);

    await act(async () => {
      root.render(<Probe publicClient={firstPublicClient} walletClient={firstWalletClient} />);
    });

    expect(mocks.connect).toHaveBeenCalledWith({
      publicClient: firstPublicClient,
      walletClient: firstWalletClient,
    });

    mocks.client.connecting = true;
    const nextPublicClient = publicClient(2);
    const nextWalletClient = walletClient(2);

    await act(async () => {
      root.render(<Probe publicClient={nextPublicClient} walletClient={nextWalletClient} />);
    });

    expect(mocks.connect).toHaveBeenLastCalledWith({
      publicClient: nextPublicClient,
      walletClient: nextWalletClient,
    });
    expect(mocks.connect).toHaveBeenCalledTimes(2);
  });
});
