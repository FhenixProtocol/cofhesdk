import { renderToString } from 'react-dom/server';
import { keccak256 } from 'viem';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  constructCofheSimulateWriteContractQueryKey,
  useCofheSimulateWriteContract,
} from './useCofheSimulateWriteContract';

const ACCOUNT = '0x0000000000000000000000000000000000000001' as const;
const CONTRACT = '0x0000000000000000000000000000000000000002' as const;

const ABI = [
  {
    type: 'function',
    name: 'setValue',
    stateMutability: 'nonpayable',
    inputs: [{ name: 'value', type: 'uint256' }],
    outputs: [],
  },
] as const;

const CALL_ARGS = {
  abi: ABI,
  address: CONTRACT,
  functionName: 'setValue',
  args: [1n],
} as const;

const state = vi.hoisted(() => ({
  queryOptions: undefined as Record<string, unknown> | undefined,
  publicClient: {} as object | undefined,
  walletClient: {
    account: { address: '0x0000000000000000000000000000000000000001' },
  } as object | undefined,
}));

vi.mock('../providers/index.js', () => ({
  useInternalQuery: (options: Record<string, unknown>) => {
    state.queryOptions = options;
    return {};
  },
}));

vi.mock('./useCofheConnection.js', () => ({
  useCofheChainId: () => 11155111,
  useCofhePublicClient: () => state.publicClient,
  useCofheWalletClient: () => state.walletClient,
}));

function Probe({ enabled }: { enabled: boolean }) {
  useCofheSimulateWriteContract(CALL_ARGS, { enabled });
  return null;
}

describe('constructCofheSimulateWriteContractQueryKey', () => {
  it('includes block selection in the cache identity', () => {
    const atFirstBlock = constructCofheSimulateWriteContractQueryKey({
      cofheChainId: 11155111,
      callArgs: { ...CALL_ARGS, blockNumber: 1n },
      resolvedAccountAddress: ACCOUNT,
    });
    const atSecondBlock = constructCofheSimulateWriteContractQueryKey({
      cofheChainId: 11155111,
      callArgs: { ...CALL_ARGS, blockNumber: 2n },
      resolvedAccountAddress: ACCOUNT,
    });

    expect(atFirstBlock).not.toEqual(atSecondBlock);
    expect(atFirstBlock).toContainEqual(expect.objectContaining({ blockNumber: '1' }));
  });

  it('includes nested state overrides and serializes their bigint values', () => {
    const withoutOverride = constructCofheSimulateWriteContractQueryKey({
      cofheChainId: 11155111,
      callArgs: CALL_ARGS,
      resolvedAccountAddress: ACCOUNT,
    });
    const withOverride = constructCofheSimulateWriteContractQueryKey({
      cofheChainId: 11155111,
      callArgs: {
        ...CALL_ARGS,
        stateOverride: [{ address: CONTRACT, balance: 10n }],
      },
      resolvedAccountAddress: ACCOUNT,
    });

    expect(withOverride).not.toEqual(withoutOverride);
    expect(withOverride).toContainEqual(
      expect.objectContaining({
        stateOverride: [{ address: CONTRACT, balance: '10' }],
      })
    );
  });

  it('uses the resolved account and chain override id instead of client objects', () => {
    const first = constructCofheSimulateWriteContractQueryKey({
      cofheChainId: 11155111,
      callArgs: {
        ...CALL_ARGS,
        account: { address: ACCOUNT, signMessage: () => undefined },
        chain: { id: 1, name: 'First chain representation' },
      },
      resolvedAccountAddress: ACCOUNT,
    });
    const second = constructCofheSimulateWriteContractQueryKey({
      cofheChainId: 11155111,
      callArgs: {
        ...CALL_ARGS,
        account: ACCOUNT,
        chain: { id: 1, name: 'Second chain representation' },
      },
      resolvedAccountAddress: ACCOUNT,
    });

    expect(first).toEqual(second);
    expect(first).toContainEqual(expect.objectContaining({ account: ACCOUNT, chainOverrideId: 1 }));
  });

  it('keeps a transaction chain id distinct from the chain override', () => {
    const first = constructCofheSimulateWriteContractQueryKey({
      cofheChainId: 11155111,
      callArgs: {
        ...CALL_ARGS,
        chainId: 1,
        chain: { id: 11155111 },
      },
      resolvedAccountAddress: ACCOUNT,
    });
    const second = constructCofheSimulateWriteContractQueryKey({
      cofheChainId: 11155111,
      callArgs: {
        ...CALL_ARGS,
        chainId: 2,
        chain: { id: 11155111 },
      },
      resolvedAccountAddress: ACCOUNT,
    });

    expect(first).not.toEqual(second);
    expect(first).toContainEqual(expect.objectContaining({ chainId: 1, chainOverrideId: 11155111 }));
  });

  it('keeps byte-array blobs compact in the cache key', () => {
    const blob = new Uint8Array(131_072);
    blob[0] = 1;
    blob[blob.length - 1] = 2;

    const key = constructCofheSimulateWriteContractQueryKey({
      cofheChainId: 11155111,
      callArgs: { ...CALL_ARGS, blobs: [blob] },
      resolvedAccountAddress: ACCOUNT,
    });

    expect(key).toContainEqual(expect.objectContaining({ blobs: [keccak256(blob)] }));
  });

  it('keeps blob content in the cache identity', () => {
    const first = constructCofheSimulateWriteContractQueryKey({
      cofheChainId: 11155111,
      callArgs: { ...CALL_ARGS, blobs: [Uint8Array.of(1)] },
      resolvedAccountAddress: ACCOUNT,
    });
    const second = constructCofheSimulateWriteContractQueryKey({
      cofheChainId: 11155111,
      callArgs: { ...CALL_ARGS, blobs: [Uint8Array.of(2)] },
      resolvedAccountAddress: ACCOUNT,
    });

    expect(first).not.toEqual(second);
  });
});

describe('useCofheSimulateWriteContract', () => {
  beforeEach(() => {
    state.queryOptions = undefined;
    state.publicClient = {};
    state.walletClient = { account: { address: ACCOUNT } };
  });

  it('does not change cache identity when enabled changes', () => {
    renderToString(<Probe enabled={false} />);
    const disabledQueryKey = state.queryOptions?.queryKey;

    renderToString(<Probe enabled />);

    expect(state.queryOptions?.enabled).toBe(true);
    expect(state.queryOptions?.queryKey).toEqual(disabledQueryKey);
  });
});
