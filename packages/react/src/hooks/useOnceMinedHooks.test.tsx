// @vitest-environment happy-dom

import * as ReactExports from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { TransactionActionType, TransactionStatus, useTransactionStore } from '@/stores/transactionStore';
import type { ConfidentialToken } from '@/types/token';

const { act } = ReactExports as typeof ReactExports & { act: typeof import('react-dom/test-utils').act };
(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const CHAIN_ID = 11155111;
const ACCOUNT = '0x00000000000000000000000000000000000000a1';
const TX_HASH = '0x1111111111111111111111111111111111111111111111111111111111111111';

const mocks = vi.hoisted(() => ({
  // What the underlying mutation reports: the hash of the last sent transaction.
  mutationData: undefined as `0x${string}` | undefined,
}));

vi.mock('../providers/index.js', () => ({
  useInternalMutation: () => ({ data: mocks.mutationData, isPending: false }),
  useInternalQueryClient: () => ({}),
  useInternalQuery: () => ({}),
}));

vi.mock('./useCofheConnection.js', () => ({
  useCofheChainId: () => CHAIN_ID,
  useCofheAccount: () => ACCOUNT,
  useCofhePublicClient: () => ({}),
  useCofheWalletClient: () => ({ account: { address: ACCOUNT } }),
}));

vi.mock('./useTransactionGlobalLifecycle.js', () => ({
  useTransactionGlobalLifecycle: () => ({ onTransactionSubmitError: () => {} }),
}));

import { useCofheTokenApprove } from './useCofheTokenApprove';
import { useCofheTokenShield } from './useCofheTokenShield';

const token: ConfidentialToken = {
  chainId: CHAIN_ID,
  address: '0x3Cdcdd0EB7311a59fDe92D44B01165B2Ca2019C4',
  name: 'fhUSDC',
  symbol: 'fhUSDC',
  decimals: 6,
  extensions: {
    fhenix: {
      confidentialityType: 'wrappedErc20',
      confidentialValueType: 'uint64',
      erc20Pair: { address: '0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee', symbol: 'USDC', decimals: 6 },
    },
  },
};

type Hook = typeof useCofheTokenApprove | typeof useCofheTokenShield;

const cases: Array<{ name: string; hook: Hook; actionType: TransactionActionType }> = [
  { name: 'useCofheTokenApprove', hook: useCofheTokenApprove, actionType: TransactionActionType.Approve },
  { name: 'useCofheTokenShield', hook: useCofheTokenShield, actionType: TransactionActionType.Shield },
];

describe.each(cases)('$name: isMining and onceMined', ({ hook, actionType }) => {
  let container: HTMLDivElement;
  let root: Root;
  const seen: boolean[] = [];
  const onceMined = vi.fn();

  function Probe() {
    const { isMining } = hook({ onceMined });
    seen.push(isMining);
    return null;
  }

  beforeEach(() => {
    useTransactionStore.setState({ transactions: {} });
    mocks.mutationData = TX_HASH;
    seen.length = 0;
    onceMined.mockReset();
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(() => {
    act(() => root.unmount());
    container.remove();
  });

  it('is not mining before the store knows the transaction', async () => {
    await act(async () => root.render(<Probe />));
    expect(seen.at(-1)).toBe(false);
    expect(onceMined).not.toHaveBeenCalled();
  });

  it('mines while the stored transaction is pending, then fires onceMined once with the final status', async () => {
    await act(async () => root.render(<Probe />));

    await act(async () => {
      useTransactionStore.getState().addTransaction({
        hash: TX_HASH,
        token,
        tokenAmount: 1n,
        tokenAmountDecimals: 6,
        chainId: CHAIN_ID,
        actionType,
        account: ACCOUNT,
      });
    });
    expect(seen.at(-1)).toBe(true);
    expect(onceMined).not.toHaveBeenCalled();

    await act(async () => {
      useTransactionStore.getState().updateTransactionStatus(CHAIN_ID, TX_HASH, TransactionStatus.Confirmed);
    });
    expect(seen.at(-1)).toBe(false);
    expect(onceMined).toHaveBeenCalledTimes(1);
    expect(onceMined).toHaveBeenCalledWith(expect.objectContaining({ hash: TX_HASH, status: 'confirmed' }));

    // A re-render does not fire it again.
    await act(async () => root.render(<Probe />));
    expect(onceMined).toHaveBeenCalledTimes(1);
  });

  it('reports a failed transaction once too', async () => {
    await act(async () => root.render(<Probe />));
    await act(async () => {
      useTransactionStore.getState().addTransaction({
        hash: TX_HASH,
        token,
        tokenAmount: 1n,
        tokenAmountDecimals: 6,
        chainId: CHAIN_ID,
        actionType,
        account: ACCOUNT,
      });
    });
    await act(async () => {
      useTransactionStore.getState().updateTransactionStatus(CHAIN_ID, TX_HASH, TransactionStatus.Failed);
    });
    expect(seen.at(-1)).toBe(false);
    expect(onceMined).toHaveBeenCalledTimes(1);
    expect(onceMined).toHaveBeenCalledWith(expect.objectContaining({ status: 'failed' }));
  });
});
