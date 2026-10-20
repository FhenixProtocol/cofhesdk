import { renderToString } from 'react-dom/server';
import type { ACP } from '@cofhe/sdk/acps';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const TX_HASH = '0x2222222222222222222222222222222222222222222222222222222222222222';
const SHARE_ID = '0x3333333333333333333333333333333333333333333333333333333333333333';
const TEST_ACP = { hash: '0xacp' } as unknown as ACP;

const mocks = vi.hoisted(() => ({
  mutations: [] as Array<{ mutationFn: (input: unknown) => Promise<unknown> }>,
  receiptStatus: 'success' as 'success' | 'reverted',
}));

vi.mock('../../providers/index.js', () => ({
  useInternalMutation: (options: (typeof mocks.mutations)[number]) => {
    mocks.mutations.push(options);
    return {};
  },
  useInternalQuery: () => ({}),
  useInternalQueryClient: () => ({ invalidateQueries: vi.fn() }),
}));

vi.mock('../useCofheClient.js', () => ({
  useCofheClient: () => ({
    getSnapshot: () => ({
      publicClient: {
        waitForTransactionReceipt: async () => ({ status: mocks.receiptStatus, transactionHash: TX_HASH }),
      },
    }),
    acp: {
      revokeACP: async () => TX_HASH,
      shareOnChain: async () => ({ txHash: TX_HASH, shareId: SHARE_ID }),
      dismissShare: async () => TX_HASH,
    },
  }),
}));

vi.mock('../useCofheACPs.js', () => ({ useCofheACPs: () => [] }));
vi.mock('../useCofheConnection.js', () => ({ useCofheAccount: () => undefined, useCofheChainId: () => undefined }));

import { useCofheRemoveShare, useCofheRevokeACP, useCofheShareOnChain } from './useOnChainSharing';

function Probe() {
  useCofheRevokeACP();
  useCofheShareOnChain();
  useCofheRemoveShare();
  return null;
}

function renderMutations() {
  mocks.mutations = [];
  renderToString(<Probe />);
  const [revoke, share, remove] = mocks.mutations;
  return { revoke: revoke!, share: share!, remove: remove! };
}

describe('on-chain sharing mutations', () => {
  beforeEach(() => {
    mocks.receiptStatus = 'success';
  });

  it('resolve once the tx is mined successfully', async () => {
    const { revoke, share, remove } = renderMutations();

    await expect(revoke.mutationFn(TEST_ACP)).resolves.toBe(TX_HASH);
    await expect(share.mutationFn(TEST_ACP)).resolves.toEqual({ txHash: TX_HASH, shareId: SHARE_ID });
    await expect(remove.mutationFn(SHARE_ID)).resolves.toBe(TX_HASH);
  });

  it('reject when the mined tx reverted', async () => {
    mocks.receiptStatus = 'reverted';
    const { revoke, share, remove } = renderMutations();

    await expect(revoke.mutationFn(TEST_ACP)).rejects.toThrow(/reverted/);
    await expect(share.mutationFn(TEST_ACP)).rejects.toThrow(/reverted/);
    await expect(remove.mutationFn(SHARE_ID)).rejects.toThrow(/reverted/);
  });
});
