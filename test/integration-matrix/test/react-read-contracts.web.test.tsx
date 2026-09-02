/**
 * React hooks integration: useCofheReadContracts (the plural, dynamic-length read) on a real chain.
 *
 * Runs in Chromium against the Anvil node booted by globalSetup, in the same spirit as
 * react-hooks.web.test.tsx: nothing on the react side is mocked — a small real component renders a
 * BATCH of reads plus one singular read, wrapped in the real CofheProvider over real viem clients,
 * with a recording EIP-1193 transport asserting exact RPC traffic.
 *
 * The contract under test is SimpleKeyValueStore — a plain uint256 => uint256 mapping — so the
 * batch is genuinely dynamic-length (one getItem per key, the token-whitelist shape) with no FHE
 * noise. What the suite demonstrates:
 *
 *   - a mined useCofheWriteContract({ invalidates: [{ address, functionName }] }) write refreshes
 *     every batch entry, each refetch gated on the node knowing the mined block;
 *   - a singular useCofheReadContract of the same call shares the batch entry's cache — no
 *     duplicate fetch, and one refetch serves both;
 *   - without `invalidates` the batch stays stale even though the chain moved, and the manual
 *     invalidation primitive (same machinery) refreshes it.
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
  useCofheReadContracts,
  useCofheWriteContract,
  useInvalidationContextStore,
  type CofheWriteInvalidates,
} from '@cofhe/react';

const ANVIL_RPC = 'http://127.0.0.1:8546';
const CHAIN_ID = 31337;
// Anvil default account #3 — #0/#1 belong to the matrix suites and #2 to the singular
// react-hooks file; a dedicated account avoids nonce races when the files run in one session.
const TEST_ACCOUNT = privateKeyToAccount('0x7c852118294e51e653712a81e05800f419141751be58f605c371e15141b007a6');

const anvilChain: Chain = defineChain({
  id: CHAIN_ID,
  name: 'Hardhat',
  nativeCurrency: { name: 'Ether', symbol: 'ETH', decimals: 18 },
  rpcUrls: { default: { http: [ANVIL_RPC] } },
});

/** test/setup/contracts/SimpleKeyValueStore.sol — plain uint256 => uint256 mapping. */
const storeAbi = [
  {
    type: 'function',
    name: 'setItem',
    stateMutability: 'nonpayable',
    inputs: [
      { name: 'key', type: 'uint256' },
      { name: 'newValue', type: 'uint256' },
    ],
    outputs: [],
  },
  {
    type: 'function',
    name: 'getItem',
    stateMutability: 'view',
    inputs: [{ name: 'key', type: 'uint256' }],
    outputs: [{ name: '', type: 'uint256' }],
  },
] as const;

const GET_ITEM_SELECTOR = toFunctionSelector(getAbiItem({ abi: storeAbi, name: 'getItem' }));

/** The dynamic-length batch under test: one getItem read per key. */
const KEYS = [1n, 2n, 3n];

// Chain interactions (connect, mining) take a while; waitFor defaults to 1s.
const EVENTUALLY = { timeout: 90_000 } as const;

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/** The read-query key prefix for `getItem` reads, as used by the manual invalidation primitive. */
function itemReadKey(contractAddress: Address) {
  return constructCofheReadContractQueryForInvalidation({
    cofheChainId: CHAIN_ID,
    address: contractAddress,
    functionName: 'getItem',
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
 * A dynamic-length batch of reads rendered as outputs, one singular read of the same call as the
 * batch's first entry (they share a cache entry), and one write behind a button — with
 * `invalidates` declaring which reads should refresh after the write is mined.
 */
function KeyValueApp({
  contractAddress,
  invalidates,
  writeKey,
  writeValue,
}: {
  contractAddress: Address;
  invalidates?: CofheWriteInvalidates;
  writeKey: bigint;
  writeValue: bigint;
}) {
  const batch = useCofheReadContracts({
    contracts: KEYS.map((key) => ({
      address: contractAddress,
      abi: storeAbi,
      functionName: 'getItem',
      args: [key],
    })),
  });
  const single = useCofheReadContract({
    address: contractAddress,
    abi: storeAbi,
    functionName: 'getItem',
    args: [KEYS[0]],
    requiresACP: false,
  });
  const { writeContract, data: txHash } = useCofheWriteContract({ invalidates });

  return (
    <main>
      {KEYS.map((key, index) => {
        const item = batch.data?.[index];
        return (
          <output key={key.toString()} aria-label={`item ${key.toString()}`}>
            {item?.result === undefined ? '' : String(item.result)}
          </output>
        );
      })}
      <output aria-label="single item 1">{single.data === undefined ? '' : single.data.toString()}</output>
      <output aria-label="tx hash">{txHash ?? ''}</output>
      <button
        onClick={() =>
          writeContract({
            address: contractAddress,
            abi: storeAbi,
            functionName: 'setItem',
            args: [writeKey, writeValue],
            account: TEST_ACCOUNT,
            chain: anvilChain,
          })
        }
      >
        set item
      </button>
    </main>
  );
}

afterEach(() => {
  useInvalidationContextStore.setState({ byKey: {} });
});

// Provided only when the Hardhat (Anvil) chain is selected — on testnet-only runs
// (e.g. the sepolia CI legs) globalSetup boots no Anvil and the suite skips itself.
const KEY_VALUE_STORE_ADDRESS = inject('anvilSimpleKeyValueStore') as Address;

function setup() {
  const contractAddress = KEY_VALUE_STORE_ADDRESS;

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

  const renderApp = (props: { invalidates?: CofheWriteInvalidates; writeKey: bigint; writeValue: bigint }) =>
    render(
      <CofheProvider config={config} queryClient={queryClient} publicClient={publicClient} walletClient={walletClient}>
        <KeyValueApp contractAddress={contractAddress} {...props} />
      </CofheProvider>
    );

  return { contractAddress, recorder, publicClient, truthClient, queryClient, renderApp };
}

/** Read the current on-screen values. */
const onScreen = () => ({
  items: KEYS.map((key) => screen.getByRole('status', { name: `item ${key.toString()}` }).textContent),
  single: screen.getByRole('status', { name: 'single item 1' }).textContent,
  txHash: screen.getByRole('status', { name: 'tx hash' }).textContent,
});

const everyItemLoaded = () => onScreen().items.every((item) => item !== '') && onScreen().single !== '';

// Skips (instead of failing) on runs where the Hardhat chain is not selected.
const describeOnAnvil = KEY_VALUE_STORE_ADDRESS ? describe : describe.skip;

describeOnAnvil('react hooks: useCofheWriteContract({ invalidates }) refreshes useCofheReadContracts (Anvil)', () => {
  it('a mined write refreshes every batch entry, block-gated, and the singular read shares the cache', async () => {
    const { contractAddress, recorder, publicClient, renderApp } = setup();
    renderApp({ invalidates: [{ address: contractAddress, functionName: 'getItem' }], writeKey: 2n, writeValue: 777n });

    // The app connects and loads the batch: one fetch per key — and none extra for the
    // singular read of key 1, which dedupes onto the batch entry's cache entry.
    await waitFor(() => expect(everyItemLoaded()).toBe(true), EVENTUALLY);
    expect(recorder.countEthCalls(GET_ITEM_SELECTOR)).toBe(KEYS.length);
    expect(onScreen().single).toBe(onScreen().items[0]);

    // Click sends a real setItem(2, 777) tx. No manual invalidation below —
    // the `invalidates` option does all of it.
    fireEvent.click(screen.getByRole('button', { name: 'set item' }));
    await waitFor(() => expect(onScreen().txHash).toMatch(/^0x/), EVENTUALLY);
    const receipt = await publicClient.waitForTransactionReceipt({ hash: onScreen().txHash as Hash });
    expect(receipt.status).toBe('success');

    // The declared reads refresh on screen by themselves, to exactly the written value...
    await waitFor(() => expect(onScreen().items[1]).toBe('777'), EVENTUALLY);
    // ...via exactly one refetch per key (the singular read is served by entry 1's refetch)...
    await waitFor(() => expect(recorder.countEthCalls(GET_ITEM_SELECTOR)).toBe(KEYS.length * 2), EVENTUALLY);
    // ...each gated on a probe that the serving node knows the mined block (and no other probes).
    expect(recorder.countBlockHashProbes(receipt.blockHash)).toBe(KEYS.length);
    expect(recorder.countBlockHashProbes()).toBe(KEYS.length);
    // The invalidation context is one-shot — consumed by the refetches that used it.
    expect(useInvalidationContextStore.getState().byKey).toEqual({});
  }, 180_000);

  it('a receipt-derived, args-narrowed target refreshes exactly the touched entry', async () => {
    const { contractAddress, recorder, publicClient, renderApp } = setup();
    renderApp({
      // The target is only known from the outcome: read the key out of the mined
      // logs (ItemSet's indexed key = topics[1]) and narrow to that exact call.
      invalidates: (receipt) => {
        const log = receipt.logs.find((l) => l.address.toLowerCase() === contractAddress.toLowerCase());
        return [{ address: contractAddress, functionName: 'getItem', args: [BigInt(log!.topics[1]!)] }];
      },
      writeKey: 2n,
      writeValue: 999n,
    });

    await waitFor(() => expect(everyItemLoaded()).toBe(true), EVENTUALLY);
    expect(recorder.countEthCalls(GET_ITEM_SELECTOR)).toBe(KEYS.length);

    fireEvent.click(screen.getByRole('button', { name: 'set item' }));
    await waitFor(() => expect(onScreen().txHash).toMatch(/^0x/), EVENTUALLY);
    const receipt = await publicClient.waitForTransactionReceipt({ hash: onScreen().txHash as Hash });
    expect(receipt.status).toBe('success');

    // Only the written key's entry refreshes...
    await waitFor(() => expect(onScreen().items[1]).toBe('999'), EVENTUALLY);
    // ...via exactly ONE refetch — keys 1 and 3 (and the singular read) untouched...
    expect(recorder.countEthCalls(GET_ITEM_SELECTOR)).toBe(KEYS.length + 1);
    // ...block-gated, and the one-shot context is consumed.
    expect(recorder.countBlockHashProbes(receipt.blockHash)).toBe(1);
    expect(useInvalidationContextStore.getState().byKey).toEqual({});
  }, 180_000);

  it('without `invalidates` the batch stays stale until invalidated manually', async () => {
    const { contractAddress, recorder, publicClient, truthClient, queryClient, renderApp } = setup();
    renderApp({ writeKey: 3n, writeValue: 888n });

    await waitFor(() => expect(everyItemLoaded()).toBe(true), EVENTUALLY);
    const item3Before = onScreen().items[2];
    expect(item3Before).not.toBe('888');

    fireEvent.click(screen.getByRole('button', { name: 'set item' }));
    await waitFor(() => expect(onScreen().txHash).toMatch(/^0x/), EVENTUALLY);
    const receipt = await publicClient.waitForTransactionReceipt({ hash: onScreen().txHash as Hash });
    expect(receipt.status).toBe('success');

    // Mined, but no `invalidates` declared: not a single refetch happens — the batch keeps
    // showing the pre-write value, even though the chain already has the new one.
    await sleep(1_000);
    const valueOnChain = await truthClient.readContract({
      address: contractAddress,
      abi: storeAbi,
      functionName: 'getItem',
      args: [3n],
    });
    expect(valueOnChain).toBe(888n);
    expect(onScreen().items[2]).toBe(item3Before);
    expect(recorder.countEthCalls(GET_ITEM_SELECTOR)).toBe(KEYS.length);
    expect(recorder.countBlockHashProbes()).toBe(0);

    // The manual primitive (what the hook option uses under the hood) reaches the batch too.
    await invalidateQueriesWithContext(
      queryClient,
      { queryKey: itemReadKey(contractAddress), exact: false },
      { blockHashToBeAwareOf: receipt.blockHash }
    );
    await waitFor(() => expect(onScreen().items[2]).toBe('888'), EVENTUALLY);
    await waitFor(() => expect(recorder.countEthCalls(GET_ITEM_SELECTOR)).toBe(KEYS.length * 2), EVENTUALLY);
    expect(recorder.countBlockHashProbes(receipt.blockHash)).toBe(KEYS.length);
  }, 180_000);
});
