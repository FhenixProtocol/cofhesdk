/**
 * React hooks integration: token balances + allowances under the READ KEY GRAMMAR.
 *
 * Public token balances (`balanceOf(account)`, or the native pseudo-read at the
 * ETH sentinel) and allowances (`allowance(owner, spender)`) are ordinary
 * contract reads — and the hooks are now wrappers around the generic read
 * machinery. This suite proves both consequences: a write whose `invalidates`
 * names them with PLAIN descriptors (no bespoke `['tokenBalance', …]` /
 * `['tokenAllowance', …]` vocabulary) refreshes them, block-gated, exactly like
 * any other read; and a direct `useCofheReadContract` of the same call shares
 * the wrapper's cache entry — two observers, ONE query, ONE `eth_call`.
 *
 * Same no-mock style as the sibling suites: real Anvil from globalSetup, real
 * CofheProvider + consumer-style component in Chromium, a recording EIP-1193
 * transport asserting exact RPC traffic — including `eth_getBalance` for the
 * native leg, whose refresh is observable for free because the tx burns gas.
 */
import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, inject, it } from 'vitest';
import { QueryClient } from '@tanstack/react-query';
import {
  createPublicClient,
  createWalletClient,
  custom,
  defineChain,
  getAbiItem,
  toFunctionSelector,
  type Address,
  type Chain,
  type EIP1193Parameters,
  type Hash,
  type Hex,
} from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { hardhat as hardhatCofheChain } from '@cofhe/sdk/chains';
import {
  CofheProvider,
  createCofheConfig,
  useCofheReadContract,
  useCofheTokenPublicBalance,
  useCofheWriteContract,
  useInvalidationContextStore,
  useTokenAllowance,
  type CofheWriteInvalidates,
  type ConfidentialToken,
} from '@cofhe/react';

const ANVIL_RPC = 'http://127.0.0.1:8546';
const CHAIN_ID = 31337;
// Anvil default account #4 — #0/#1 (matrix), #2 (react-hooks) and #3
// (read-contracts) are taken; a dedicated account avoids nonce races.
const TEST_ACCOUNT = privateKeyToAccount('0x47e179ec197488593b187f80a00eb0da91f1b9d0b13f8733639f19c30a34926a');
const SPENDER = '0x00000000000000000000000000000000000000b2' as const;
const ETH_SENTINEL_LOWERCASE = '0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee' as const;

const anvilChain: Chain = defineChain({
  id: CHAIN_ID,
  name: 'Hardhat',
  nativeCurrency: { name: 'Ether', symbol: 'ETH', decimals: 18 },
  rpcUrls: { default: { http: [ANVIL_RPC] } },
});

/** test/setup/contracts/SimpleERC20.sol — minimal mint/approve fixture. */
const erc20Abi = [
  {
    type: 'function',
    name: 'mint',
    stateMutability: 'nonpayable',
    inputs: [
      { name: 'to', type: 'address' },
      { name: 'amount', type: 'uint256' },
    ],
    outputs: [],
  },
  {
    type: 'function',
    name: 'approve',
    stateMutability: 'nonpayable',
    inputs: [
      { name: 'spender', type: 'address' },
      { name: 'amount', type: 'uint256' },
    ],
    outputs: [{ type: 'bool' }],
  },
  {
    type: 'function',
    name: 'balanceOf',
    stateMutability: 'view',
    inputs: [{ name: '', type: 'address' }],
    outputs: [{ type: 'uint256' }],
  },
  {
    type: 'function',
    name: 'allowance',
    stateMutability: 'view',
    inputs: [
      { name: '', type: 'address' },
      { name: '', type: 'address' },
    ],
    outputs: [{ type: 'uint256' }],
  },
] as const;

const BALANCE_OF_SELECTOR = toFunctionSelector(getAbiItem({ abi: erc20Abi, name: 'balanceOf' }));
const ALLOWANCE_SELECTOR = toFunctionSelector(getAbiItem({ abi: erc20Abi, name: 'allowance' }));

// Chain interactions (connect, mining) take a while; waitFor defaults to 1s.
const EVENTUALLY = { timeout: 90_000 } as const;

type RpcCall = { method: string; params: unknown };

/** EIP-1193 provider over plain fetch that records every request it forwards. */
function createRecordingProvider(url: string) {
  let id = 0;
  const calls: RpcCall[] = [];

  const request = async ({ method, params }: EIP1193Parameters) => {
    calls.push({ method, params });
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ jsonrpc: '2.0', id: ++id, method, params: params ?? [] }),
    });
    const json = (await res.json()) as { result?: unknown; error?: { message: string } };
    if (json.error) throw new Error(`RPC ${method} failed: ${json.error.message}`);
    return json.result;
  };

  const countEthCalls = (selector: Hex) =>
    calls.filter((call) => {
      if (call.method !== 'eth_call') return false;
      const [tx] = call.params as [{ data?: Hex }];
      return tx?.data?.startsWith(selector) ?? false;
    }).length;

  const countByMethod = (method: string) => calls.filter((call) => call.method === method).length;

  const countBlockHashProbes = (blockHash?: Hex) =>
    calls.filter((call) => {
      if (call.method !== 'eth_getBlockByHash') return false;
      if (!blockHash) return true;
      const [hash] = call.params as [Hex];
      return hash === blockHash;
    }).length;

  return { request, calls, countEthCalls, countByMethod, countBlockHashProbes };
}

/** Minimal ConfidentialToken fixtures: the public-balance path only reads
 *  `extensions.fhenix.{confidentialityType, erc20Pair}` + decimals. */
function wrappedTokenFixture(pairAddress: Address, decimals: number): ConfidentialToken {
  return {
    chainId: CHAIN_ID,
    address: pairAddress,
    name: 'Fixture',
    symbol: 'FIX',
    decimals,
    logoURI: '',
    extensions: {
      fhenix: {
        confidentialityType: 'wrappedErc20',
        erc20Pair: { address: pairAddress, symbol: 'FIX', decimals },
      },
    },
  } as never;
}

function TokenFundsApp({
  erc20,
  invalidates,
  action,
}: {
  erc20: Address;
  invalidates?: CofheWriteInvalidates;
  action: { functionName: 'mint' | 'approve'; args: readonly unknown[] };
}) {
  const allowance = useTokenAllowance({
    tokenAddress: erc20,
    ownerAddress: TEST_ACCOUNT.address,
    spenderAddress: SPENDER,
  });
  const erc20Balance = useCofheTokenPublicBalance({
    token: wrappedTokenFixture(erc20, 6),
    accountAddress: TEST_ACCOUNT.address,
  });
  const ethBalance = useCofheTokenPublicBalance({
    token: wrappedTokenFixture(ETH_SENTINEL_LOWERCASE, 18),
    accountAddress: TEST_ACCOUNT.address,
    // Full-ish precision: the observable is the GAS a tx burns, which is far
    // below the default 5 display decimals.
    displayDecimals: 12,
  });
  // The hooks are wrappers around the generic read machinery, so a direct read
  // of the SAME call must land on the SAME query — one cache entry, one fetch.
  const directRead = useCofheReadContract({
    address: erc20,
    abi: erc20Abi,
    functionName: 'balanceOf',
    args: [TEST_ACCOUNT.address],
    requiresACP: false,
  });
  const { writeContract, data: txHash } = useCofheWriteContract({ invalidates });

  return (
    <main>
      <output aria-label="allowance">{allowance.data === undefined ? '' : allowance.data.toString()}</output>
      <output aria-label="erc20 balance">{erc20Balance.data?.formatted ?? ''}</output>
      <output aria-label="eth balance">{ethBalance.data?.formatted ?? ''}</output>
      <output aria-label="direct read">{directRead.data === undefined ? '' : String(directRead.data)}</output>
      <output aria-label="tx hash">{txHash ?? ''}</output>
      <button
        onClick={() =>
          writeContract({
            address: erc20,
            abi: erc20Abi,
            functionName: action.functionName,
            args: action.args,
            account: TEST_ACCOUNT,
            chain: anvilChain,
          } as never)
        }
      >
        send
      </button>
    </main>
  );
}

afterEach(() => {
  useInvalidationContextStore.setState({ byKey: {} });
});

// Provided only when the Hardhat (Anvil) chain is selected.
const ERC20_ADDRESS = inject('anvilSimpleErc20') as Address;

function setup() {
  const recorder = createRecordingProvider(ANVIL_RPC);
  const publicClient = createPublicClient({ chain: anvilChain, transport: custom(recorder) });
  const walletClient = createWalletClient({ chain: anvilChain, transport: custom(recorder), account: TEST_ACCOUNT });
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const config = createCofheConfig({
    supportedChains: [hardhatCofheChain],
    react: { autogenerateACPs: false },
  });

  const renderApp = (props: {
    invalidates?: CofheWriteInvalidates;
    action: { functionName: 'mint' | 'approve'; args: readonly unknown[] };
  }) =>
    render(
      <CofheProvider config={config} queryClient={queryClient} publicClient={publicClient} walletClient={walletClient}>
        <TokenFundsApp erc20={ERC20_ADDRESS} {...props} />
      </CofheProvider>
    );

  return { recorder, publicClient, renderApp };
}

const onScreen = () => ({
  allowance: screen.getByRole('status', { name: 'allowance' }).textContent,
  erc20: screen.getByRole('status', { name: 'erc20 balance' }).textContent,
  eth: screen.getByRole('status', { name: 'eth balance' }).textContent,
  direct: screen.getByRole('status', { name: 'direct read' }).textContent,
  txHash: screen.getByRole('status', { name: 'tx hash' }).textContent,
});

const loaded = () =>
  onScreen().allowance !== '' && onScreen().erc20 !== '' && onScreen().eth !== '' && onScreen().direct !== '';

const asNumber = (formatted: string | null) => Number((formatted ?? '').replace(/,/g, ''));

const describeOnAnvil = ERC20_ADDRESS ? describe : describe.skip;

describeOnAnvil('token balances + allowances under the read key grammar (Anvil)', () => {
  it('an approve with a plain args-narrowed allowance descriptor refreshes the allowance, block-gated', async () => {
    const { recorder, publicClient, renderApp } = setup();
    renderApp({
      invalidates: [
        {
          address: ERC20_ADDRESS,
          functionName: 'allowance',
          args: [TEST_ACCOUNT.address, SPENDER],
        },
      ],
      action: { functionName: 'approve', args: [SPENDER, 777n] },
    });

    await waitFor(() => expect(loaded()).toBe(true), EVENTUALLY);
    expect(recorder.countEthCalls(ALLOWANCE_SELECTOR)).toBe(1);

    fireEvent.click(screen.getByRole('button', { name: 'send' }));
    await waitFor(() => expect(onScreen().txHash).toMatch(/^0x/), EVENTUALLY);
    const receipt = await publicClient.waitForTransactionReceipt({ hash: onScreen().txHash as Hash });
    expect(receipt.status).toBe('success');

    // The allowance refreshes to the approved amount, via exactly one refetch,
    // gated on the mined block — no bespoke key vocabulary anywhere.
    await waitFor(() => expect(onScreen().allowance).toBe('777'), EVENTUALLY);
    expect(recorder.countEthCalls(ALLOWANCE_SELECTOR)).toBe(2);
    expect(recorder.countBlockHashProbes(receipt.blockHash)).toBeGreaterThanOrEqual(1);
    // The balance reads were NOT touched by the narrowed target.
    expect(recorder.countEthCalls(BALANCE_OF_SELECTOR)).toBe(1);
    expect(recorder.countByMethod('eth_getBalance')).toBe(1);
  });

  it('a mint with plain balanceOf descriptors refreshes the ERC20 balance AND the native pseudo-read', async () => {
    const { recorder, publicClient, renderApp } = setup();
    renderApp({
      invalidates: [
        { address: ERC20_ADDRESS, functionName: 'balanceOf', args: [TEST_ACCOUNT.address] },
        // Native ETH is the pseudo-read at the sentinel address — same grammar.
        { address: ETH_SENTINEL_LOWERCASE, functionName: 'balanceOf', args: [TEST_ACCOUNT.address] },
      ],
      action: { functionName: 'mint', args: [TEST_ACCOUNT.address, 1_000_000_000n] },
    });

    await waitFor(() => expect(loaded()).toBe(true), EVENTUALLY);
    const erc20Before = asNumber(onScreen().erc20);
    const ethBefore = asNumber(onScreen().eth);
    const directBefore = BigInt(onScreen().direct ?? '');
    expect(ethBefore).toBeGreaterThan(0);
    // Cache identity: the balance hook and the direct `useCofheReadContract` of
    // the same call are TWO observers of ONE query — a single balanceOf eth_call
    // served both.
    expect(recorder.countEthCalls(BALANCE_OF_SELECTOR)).toBe(1);

    fireEvent.click(screen.getByRole('button', { name: 'send' }));
    await waitFor(() => expect(onScreen().txHash).toMatch(/^0x/), EVENTUALLY);
    const receipt = await publicClient.waitForTransactionReceipt({ hash: onScreen().txHash as Hash });
    expect(receipt.status).toBe('success');

    // ERC20 balance grows by the minted 1,000 (6 decimals)...
    await waitFor(() => expect(asNumber(onScreen().erc20)).toBeCloseTo(erc20Before + 1000, 3), EVENTUALLY);
    // ...and the direct read of the shared query sees the same mint...
    await waitFor(() => expect(BigInt(onScreen().direct ?? '')).toBe(directBefore + 1_000_000_000n), EVENTUALLY);
    // ...and the native pseudo-read refetches (observed on the wire), landing on
    // a LOWER balance — the gas the tx burned is the free observable.
    await waitFor(() => expect(recorder.countByMethod('eth_getBalance')).toBe(2), EVENTUALLY);
    await waitFor(() => expect(asNumber(onScreen().eth)).toBeLessThan(ethBefore), EVENTUALLY);
    // Still one query behind both balance observers: ONE refetch served them.
    expect(recorder.countEthCalls(BALANCE_OF_SELECTOR)).toBe(2);
    // The allowance read was NOT touched.
    expect(recorder.countEthCalls(ALLOWANCE_SELECTOR)).toBe(1);
    expect(useInvalidationContextStore.getState().byKey).toEqual({});
  });
});
