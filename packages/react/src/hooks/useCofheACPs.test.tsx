// @vitest-environment happy-dom
import * as ReactExports from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const { act } = ReactExports as typeof ReactExports & { act: typeof import('react-dom/test-utils').act };

const CHAIN_ID = 11155111;
const ACCOUNT = '0x0000000000000000000000000000000000000001';
const ACP_HASH = '0xabc';

const mocks = vi.hoisted(() => ({ state: { acps: {} as any, activeACPHash: {} as any } }));

vi.mock('../providers', () => ({
  useCofheContext: () => ({
    client: { acp: { subscribe: () => () => {}, getSnapshot: () => mocks.state } },
  }),
}));

vi.mock('./useCofheConnection', () => ({
  useCofheConnection: () => ({ connected: true, chainId: CHAIN_ID, account: ACCOUNT }),
}));

// Only the expiry part of ACPUtils.isValid matters here.
vi.mock('@cofhe/sdk/acps', async (importOriginal) => {
  const actual = (await importOriginal()) as any;
  return {
    ...actual,
    ACPUtils: {
      ...actual.ACPUtils,
      deserialize: (serialized: any) => serialized,
      isValid: (acp: any) => ({ valid: acp.expiration * 1000 > Date.now() }),
    },
  };
});

import { useCofheActiveACP } from './useCofheACPs';

let seen: Array<boolean | undefined> = [];
function ActiveACPProbe() {
  seen.push(useCofheActiveACP()?.isValid);
  return null;
}

describe('useCofheActiveACP', () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    vi.useFakeTimers({ toFake: ['Date', 'setTimeout', 'clearTimeout'] });
    vi.setSystemTime(new Date('2026-11-03T00:00:00Z'));
    const expiration = Math.floor(Date.now() / 1000) + 60;
    mocks.state.acps = { [CHAIN_ID]: { [ACCOUNT]: { [ACP_HASH]: { hash: ACP_HASH, type: 'self', expiration } } } };
    mocks.state.activeACPHash = { [CHAIN_ID]: { [ACCOUNT]: ACP_HASH } };
    container = document.createElement('div');
    root = createRoot(container);
    seen = [];
  });

  afterEach(() => {
    act(() => root.unmount());
    vi.useRealTimers();
  });

  it('reports the active ACP as invalid once it expires while mounted', async () => {
    await act(async () => root.render(<ActiveACPProbe />));
    expect(seen.at(-1)).toBe(true);

    await act(async () => {
      await vi.advanceTimersByTimeAsync(61_000);
    });

    expect(seen.at(-1)).toBe(false);
  });
});
