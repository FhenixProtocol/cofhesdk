import { renderToString } from 'react-dom/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const CONTRACT = '0x1111111111111111111111111111111111111111';
const ITEM = { data: 1n, utype: 2, securityZone: 1 };

const mocks = vi.hoisted(() => ({
  mutations: [] as Array<{ mutationFn: (input: unknown) => Promise<unknown> }>,
  setAccount: vi.fn(),
  setChainId: vi.fn(),
  setSecurityZone: vi.fn(),
  onStep: vi.fn(),
  setConsumingContract: vi.fn(),
  execute: vi.fn(async () => ['0xhash', '0xsig'] as const),
}));

vi.mock('../providers/index.js', () => ({
  useCofheContext: () => ({
    client: {
      encryptInputs: () => {
        const builder = {
          setConsumingContract: (...args: unknown[]) => {
            mocks.setConsumingContract(...args);
            return builder;
          },
          onStep: (...args: unknown[]) => {
            mocks.onStep(...args);
            return builder;
          },
          setAccount: (...args: unknown[]) => {
            mocks.setAccount(...args);
            return builder;
          },
          setChainId: (...args: unknown[]) => {
            mocks.setChainId(...args);
            return builder;
          },
          setSecurityZone: (...args: unknown[]) => {
            mocks.setSecurityZone(...args);
            return builder;
          },
          execute: mocks.execute,
        };
        return builder;
      },
    },
  }),
  useInternalMutation: (options: (typeof mocks.mutations)[number]) => {
    mocks.mutations.push(options);
    return {
      mutateAsync: (vars: unknown) => options.mutationFn(vars),
      mutate: vi.fn(),
      isPending: false,
    };
  },
}));

vi.mock('./internal/useStepsState', () => ({
  useStepsState: () => ({
    onStep: vi.fn(),
    onSetKey: vi.fn(),
    compactSteps: {},
    lastStep: null,
  }),
}));

import { useCofheEncrypt } from './useCofheEncrypt';

function Probe() {
  useCofheEncrypt();
  return null;
}

function renderEncryptMutation() {
  mocks.mutations = [];
  renderToString(<Probe />);
  return mocks.mutations[0]!;
}

describe('useCofheEncrypt', () => {
  beforeEach(() => {
    mocks.setAccount.mockClear();
    mocks.setChainId.mockClear();
    mocks.setSecurityZone.mockClear();
    mocks.onStep.mockClear();
    mocks.setConsumingContract.mockClear();
    mocks.execute.mockClear();
  });

  it('applies securityZone 0 and chainId 0 (truthy checks used to skip them)', async () => {
    const { mutationFn } = renderEncryptMutation();

    await mutationFn({
      items: [ITEM],
      consumingContract: CONTRACT,
      securityZone: 0,
      chainId: 0,
    });

    expect(mocks.setSecurityZone).toHaveBeenCalledWith(0);
    expect(mocks.setChainId).toHaveBeenCalledWith(0);
  });

  it('leaves zone and chain unset when omitted', async () => {
    const { mutationFn } = renderEncryptMutation();

    await mutationFn({
      items: [ITEM],
      consumingContract: CONTRACT,
    });

    expect(mocks.setSecurityZone).not.toHaveBeenCalled();
    expect(mocks.setChainId).not.toHaveBeenCalled();
  });
});
