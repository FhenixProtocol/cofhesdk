// @vitest-environment happy-dom
import * as ReactExports from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { ConfidentialToken } from '@/types/token';

const { act } = ReactExports as typeof ReactExports & { act: typeof import('react-dom/test-utils').act };

const mocks = vi.hoisted(() => ({ unshieldInput: undefined as any }));

const ACCOUNT = '0x00000000000000000000000000000000000000a1';

vi.mock('@/hooks/useCofheConnection', () => ({
  useCofheAccount: () => ACCOUNT,
  useCofheChainId: () => 84532,
}));
vi.mock('@/hooks/useCofheTokenDecryptedBalance', () => ({
  useCofheTokenDecryptedBalance: () => ({ data: undefined, isFetching: false }),
}));
vi.mock('@/hooks/useCofheTokenPublicBalance', () => ({
  useCofheTokenPublicBalance: () => ({ data: undefined, isFetching: false }),
}));
vi.mock('@/hooks/useCofheTokenShield', () => ({ useCofheTokenShield: () => ({}) }));
vi.mock('@/hooks/useOnceTransactionMined', () => ({ useOnceTransactionMined: () => ({ isMining: false }) }));
vi.mock('@/hooks/useIsUnshieldingMining', () => ({ useIsUnshieldingMining: () => false }));
vi.mock('@/hooks/useReschedulableTimeout', () => ({ useReschedulableTimeout: () => ({ schedule: () => {} }) }));
vi.mock('@/hooks', () => ({
  getCofheTokenClaimUnshieldedCallArgs: () => undefined,
  getCofheTokenShieldCallArgs: () => undefined,
  getCofheTokenUnshieldCallArgs: () => undefined,
  useCofheSimulateWriteContract: () => ({ error: null, isFetching: false }),
  useCofheTokenApprove: () => ({}),
  useCofheTokenClaimUnshielded: () => ({ isPending: false }),
  useCofheTokenUnshield: (input: unknown) => {
    mocks.unshieldInput = input;
    return { isPending: false, isTokenUnshieldMining: false, mutateAsync: async () => '0x' };
  },
  useCofheTokenClaimable: () => ({ data: undefined, isFetching: false }),
  useCofheTokensWithExistingEncryptedBalances: () => ({ tokensWithExistingEncryptedBalance: [] }),
  useTokensWithPublicBalances: () => ({ tokensWithPublicBalances: [] }),
  useTokenAllowance: () => ({ data: undefined, isFetching: false }),
}));
vi.mock('@/stores', () => ({
  usePortalModals: () => ({ openModal: () => {} }),
  usePortalNavigation: () => ({ navigateBack: () => {} }),
}));
vi.mock('../components/CofheTokenConfidentialBalance', () => ({
  BalanceType: { Public: 'public', Confidential: 'confidential' },
  CofheTokenPublicBalance: () => null,
  CofheTokenConfidentialBalance: () => null,
}));
vi.mock('../components/index', () => ({
  ActionButton: ({ label }: { label: string }) => <button>{label}</button>,
  AmountInput: () => null,
  CofheTokenConfidentialBalance: () => null,
  TokenIcon: () => null,
}));
vi.mock('../components/PageContainer', () => ({
  PageContainer: ({ header, content }: any) => (
    <div>
      {header}
      {content}
    </div>
  ),
}));

import { ShieldPageV2 } from './ShieldPageV2';

const token: ConfidentialToken = {
  chainId: 84532,
  address: '0x3Cdcdd0EB7311a59fDe92D44B01165B2Ca2019C4',
  name: 'fhETH',
  symbol: 'fhETH',
  decimals: 6,
  extensions: {
    fhenix: {
      confidentialityType: 'wrappedNative',
      confidentialValueType: 'uint64',
      erc20Pair: { address: '0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee', symbol: 'ETH', decimals: 18 },
    },
  },
};

describe('ShieldPageV2 unshield', () => {
  let container: HTMLDivElement;
  let root: Root;
  beforeEach(() => {
    container = document.createElement('div');
    root = createRoot(container);
  });
  afterEach(() => act(() => root.unmount()));

  it('clears the previous error when a new unshield starts', async () => {
    await act(async () => root.render(<ShieldPageV2 token={token} defaultMode="unshield" />));

    // 1st attempt: user rejects in the wallet.
    await act(async () => mocks.unshieldInput.onTransactionSubmitError(new Error('User rejected the request.')));
    expect(container.textContent).toContain('User rejected the request.');

    // 2nd attempt: useCofheTokenUnshield passes onUserSignatureRequest as the mutation's onMutate.
    await act(async () => mocks.unshieldInput.onUserSignatureRequest({}, {}));

    expect(container.textContent).not.toContain('User rejected the request.');
    expect(container.textContent).toContain('Preparing unshielding transaction...');
  });
});
