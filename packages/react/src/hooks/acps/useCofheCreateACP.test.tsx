import { renderToString } from 'react-dom/server';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const ACCOUNT = '0x1111111111111111111111111111111111111111';
const RECIPIENT = '0x2222222222222222222222222222222222222222';
const WEEK = 7 * 24 * 60 * 60;
const LOCAL_NOW = 1_800_000_000;

const mocks = vi.hoisted(() => ({
  mutations: [] as Array<{ mutationFn: (input: unknown) => Promise<unknown> }>,
  latestBlockTimestamp: 0,
  createSelf: vi.fn(),
  createSharing: vi.fn(),
}));

vi.mock('../../providers/index.js', () => ({
  useInternalMutation: (options: (typeof mocks.mutations)[number]) => {
    mocks.mutations.push(options);
    return {};
  },
}));

vi.mock('@/stores/portalPersisted.js', () => ({
  usePortalPersisted: () => ({ setHasCreatedFirstACP: () => {} }),
}));

vi.mock('../useCofheClient.js', () => ({
  useCofheClient: () => ({
    getSnapshot: () => ({
      account: ACCOUNT,
      publicClient: { getBlock: async () => ({ timestamp: BigInt(mocks.latestBlockTimestamp) }) },
    }),
    acp: { createSelf: mocks.createSelf, createSharing: mocks.createSharing },
  }),
}));

import { useCofheCreateACP } from './useCofheCreateACP';

function Probe() {
  useCofheCreateACP();
  return null;
}

function renderCreateACP() {
  mocks.mutations = [];
  renderToString(<Probe />);
  return mocks.mutations[0]!;
}

describe('useCofheCreateACP', () => {
  beforeEach(() => {
    vi.useFakeTimers({ now: LOCAL_NOW * 1000 });
    mocks.createSelf.mockReset();
    mocks.createSharing.mockReset();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('counts durationSeconds from the latest block when the chain clock is ahead', async () => {
    // e.g. a Hardhat node after `time.increase(30 days)`: the ACL checks expiry against this block
    mocks.latestBlockTimestamp = LOCAL_NOW + 30 * 24 * 60 * 60;
    const create = renderCreateACP();

    await create.mutationFn({ name: 'Self', isSelf: true, durationSeconds: WEEK });
    await create.mutationFn({ name: 'Shared', isSelf: false, receiver: RECIPIENT, durationSeconds: WEEK });

    const expiration = mocks.latestBlockTimestamp + WEEK;
    expect(mocks.createSelf).toHaveBeenCalledWith({ expiration, issuer: ACCOUNT, name: 'Self' });
    expect(mocks.createSharing).toHaveBeenCalledWith({
      expiration,
      issuer: ACCOUNT,
      recipient: RECIPIENT,
      name: 'Shared',
    });
  });

  it('counts durationSeconds from the local clock when the latest block is older', async () => {
    // an idle node whose last block was mined two hours ago
    mocks.latestBlockTimestamp = LOCAL_NOW - 2 * 60 * 60;
    const create = renderCreateACP();

    await create.mutationFn({ name: 'Self', isSelf: true, durationSeconds: 60 * 60 });

    expect(mocks.createSelf).toHaveBeenCalledWith({ expiration: LOCAL_NOW + 60 * 60, issuer: ACCOUNT, name: 'Self' });
  });

  it('keeps an explicit expirationSeconds as given', async () => {
    const create = renderCreateACP();

    await create.mutationFn({ name: 'Self', isSelf: true, expirationSeconds: 1_900_000_000 });

    expect(mocks.createSelf).toHaveBeenCalledWith({ expiration: 1_900_000_000, issuer: ACCOUNT, name: 'Self' });
  });
});
