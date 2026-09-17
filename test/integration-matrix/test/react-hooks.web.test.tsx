/**
 * React hooks integration: useCofheWriteContract + useCofheReadContract on a real chain.
 *
 * Runs in Chromium against the Anvil node booted by globalSetup. The contract under test
 * is SimpleStorage — a deliberately plain (non-confidential) setValue/getValue fixture —
 * so the test isolates exactly one feature with no FHE noise: declarative post-write
 * cache invalidation.
 *
 *   useCofheWriteContract({ invalidates: [{ address, functionName }] })
 *
 * After a successful write the hook waits for the tx to mine, then invalidates the
 * declared read queries with the mined block's hash as invalidation context — so the
 * corresponding useCofheReadContract refetches, and only trusts an RPC node that already
 * knows the mined block.
 *
 * Nothing on the react side is mocked: a small real component (SimpleStorageApp) renders
 * the read and sends the write from a button click, wrapped in the real CofheProvider
 * which auto-connects a real CofheClient over real viem clients. The viem transport is a
 * thin recording EIP-1193 provider over fetch, so the tests also assert exact RPC
 * traffic: how often the read fetched, and whether the refetch was gated on
 * `eth_getBlockByHash` for the mined block.
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
  http,
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
  constructCofheReadContractQueryForInvalidation,
  invalidateQueriesWithContext,
  useCofheReadContract,
  useCofheWriteContract,
  useInvalidationContextStore,
  type CofheWriteInvalidationTarget,
} from '@cofhe/react';

const ANVIL_RPC = 'http://127.0.0.1:8546';
const CHAIN_ID = 31337;
// Anvil default account #2 — the matrix suites use #0 (deployer/bob) and #1 (alice),
// so a dedicated account avoids nonce races when the files run in one session.
const TEST_ACCOUNT = privateKeyToAccount('0x5de4111afa1a4b94908f83103eb1f1706367c2e68ca870fc3fb9a804cdab365a');

const anvilChain: Chain = defineChain({
  id: CHAIN_ID,
  name: 'Hardhat',
  nativeCurrency: { name: 'Ether', symbol: 'ETH', decimals: 18 },
  rpcUrls: { default: { http: [ANVIL_RPC] } },
});

/** test/setup/contracts/SimpleStorage.sol — plain value storage. */
const simpleStorageAbi = [
  {
    type: 'function',
    name: 'setValue',
    stateMutability: 'nonpayable',
    inputs: [{ name: 'newValue', type: 'uint256' }],
    outputs: [],
  },
  { type: 'function', name: 'getValue', stateMutability: 'view', inputs: [], outputs: [{ name: '', type: 'uint256' }] },
] as const;

const GET_VALUE_SELECTOR = toFunctionSelector(getAbiItem({ abi: simpleStorageAbi, name: 'getValue' }));

// Chain interactions (connect, mining) take a while; waitFor defaults to 1s.
const EVENTUALLY = { timeout: 90_000 } as const;

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/** The read-query key prefix for `getValue` reads, as used by the manual invalidation primitive. */
function valueReadKey(contractAddress: Address) {
  return constructCofheReadContractQueryForInvalidation({
    cofheChainId: CHAIN_ID,
    address: contractAddress,
    functionName: 'getValue',
  });
}

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

  const countBlockHashProbes = (blockHash?: Hex) =>
    calls.filter((call) => {
      if (call.method !== 'eth_getBlockByHash') return false;
      if (!blockHash) return true;
      const [hash] = call.params as [Hex];
      return hash === blockHash;
    }).length;

  return { request, calls, countEthCalls, countBlockHashProbes };
}

/**
 * The app under test: written the way a consumer would write it.
 * One read rendered as text, one write behind a button — with `invalidates`
 * declaring which read should refresh after the write is mined.
 */
function SimpleStorageApp({
  contractAddress,
  invalidates,
  writeValue,
}: {
  contractAddress: Address;
  invalidates?: readonly CofheWriteInvalidationTarget[];
  writeValue: bigint;
}) {
  const value = useCofheReadContract({
    address: contractAddress,
    abi: simpleStorageAbi,
    functionName: 'getValue',
    requiresACP: false,
  });
  const { writeContract, data: txHash } = useCofheWriteContract({ invalidates });

  return (
    <main>
      <output aria-label="value">{value.data === undefined ? '' : value.data.toString()}</output>
      <output aria-label="tx hash">{txHash ?? ''}</output>
      <button
        onClick={() =>
          writeContract({
            address: contractAddress,
            abi: simpleStorageAbi,
            functionName: 'setValue',
            args: [writeValue],
            account: TEST_ACCOUNT,
            chain: anvilChain,
          })
        }
      >
        set value
      </button>
    </main>
  );
}

afterEach(() => {
  useInvalidationContextStore.setState({ byKey: {} });
});

// Provided only when the Hardhat (Anvil) chain is selected — on testnet-only runs
// (e.g. the sepolia CI legs) globalSetup boots no Anvil and the suite skips itself.
const SIMPLE_STORAGE_ADDRESS = inject('anvilSimpleStorage') as Address;

function setup() {
  const contractAddress = SIMPLE_STORAGE_ADDRESS;

  const recorder = createRecordingProvider(ANVIL_RPC);
  const publicClient = createPublicClient({ chain: anvilChain, transport: custom(recorder) });
  const walletClient = createWalletClient({ chain: anvilChain, transport: custom(recorder), account: TEST_ACCOUNT });
  // For asserting on-chain truth without polluting the recorder's call counts.
  const truthClient = createPublicClient({ chain: anvilChain, transport: http(ANVIL_RPC) });
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const config = createCofheConfig({
    supportedChains: [hardhatCofheChain],
    react: { autogenerateACPs: false },
  });

  const renderApp = (props: { invalidates?: readonly CofheWriteInvalidationTarget[]; writeValue: bigint }) =>
    render(
      <CofheProvider config={config} queryClient={queryClient} publicClient={publicClient} walletClient={walletClient}>
        <SimpleStorageApp contractAddress={contractAddress} {...props} />
      </CofheProvider>
    );

  return { contractAddress, recorder, publicClient, truthClient, queryClient, renderApp };
}

/** Read the current on-screen values. */
const onScreen = () => ({
  value: screen.getByRole('status', { name: 'value' }).textContent,
  txHash: screen.getByRole('status', { name: 'tx hash' }).textContent,
});

// Skips (instead of failing) on runs where the Hardhat chain is not selected.
const describeOnAnvil = SIMPLE_STORAGE_ADDRESS ? describe : describe.skip;

describeOnAnvil('react hooks: useCofheWriteContract({ invalidates }) refreshes useCofheReadContract (Anvil)', () => {
  it('a mined write invalidates the declared read, which refetches gated on the mined block', async () => {
    const { contractAddress, recorder, publicClient, renderApp } = setup();
    renderApp({ invalidates: [{ address: contractAddress, functionName: 'getValue' }], writeValue: 777n });

    // The app connects and loads its read: exactly one fetch.
    await waitFor(() => expect(onScreen().value).not.toBe(''), EVENTUALLY);
    expect(recorder.countEthCalls(GET_VALUE_SELECTOR)).toBe(1);

    // Click sends a real setValue(777) tx. No manual invalidation below —
    // the `invalidates` option does all of it.
    fireEvent.click(screen.getByRole('button', { name: 'set value' }));
    await waitFor(() => expect(onScreen().txHash).toMatch(/^0x/), EVENTUALLY);
    const receipt = await publicClient.waitForTransactionReceipt({ hash: onScreen().txHash as Hash });
    expect(receipt.status).toBe('success');

    // The declared read refreshes on screen by itself, to exactly the written value...
    await waitFor(() => expect(onScreen().value).toBe('777'), EVENTUALLY);
    // ...via exactly one refetch...
    expect(recorder.countEthCalls(GET_VALUE_SELECTOR)).toBe(2);
    // ...gated on exactly one probe that the serving node knows the mined block (and no others).
    expect(recorder.countBlockHashProbes(receipt.blockHash)).toBe(1);
    expect(recorder.countBlockHashProbes()).toBe(1);
    // The invalidation context is one-shot — consumed by the refetch that used it.
    expect(useInvalidationContextStore.getState().byKey).toEqual({});
  }, 180_000);

  it('without `invalidates` the read stays stale until invalidated manually', async () => {
    const { contractAddress, recorder, publicClient, truthClient, queryClient, renderApp } = setup();
    renderApp({ writeValue: 888n });

    await waitFor(() => expect(onScreen().value).not.toBe(''), EVENTUALLY);
    const valueBefore = onScreen().value;
    expect(valueBefore).not.toBe('888');

    fireEvent.click(screen.getByRole('button', { name: 'set value' }));
    await waitFor(() => expect(onScreen().txHash).toMatch(/^0x/), EVENTUALLY);
    const receipt = await publicClient.waitForTransactionReceipt({ hash: onScreen().txHash as Hash });
    expect(receipt.status).toBe('success');

    // Mined, but no `invalidates` declared: not a single refetch happens — the read
    // keeps showing the pre-write value, even though the chain already has the new one.
    await sleep(1_000);
    const valueOnChain = await truthClient.readContract({
      address: contractAddress,
      abi: simpleStorageAbi,
      functionName: 'getValue',
    });
    expect(valueOnChain).toBe(888n);
    expect(onScreen().value).toBe(valueBefore);
    expect(recorder.countEthCalls(GET_VALUE_SELECTOR)).toBe(1);
    expect(recorder.countBlockHashProbes()).toBe(0);

    // The manual primitive (what the hook option uses under the hood) still works.
    await invalidateQueriesWithContext(
      queryClient,
      { queryKey: valueReadKey(contractAddress), exact: false },
      { blockHashToBeAwareOf: receipt.blockHash }
    );
    await waitFor(() => expect(onScreen().value).toBe('888'), EVENTUALLY);
    expect(recorder.countEthCalls(GET_VALUE_SELECTOR)).toBe(2);
    expect(recorder.countBlockHashProbes(receipt.blockHash)).toBe(1);
  }, 180_000);
});
