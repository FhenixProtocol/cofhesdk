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
 *     invalidation primitive (same machinery) refreshes it;
 *   - the invalidation context is a TTL WATERMARK, not a one-shot note: a read whose first fetch
 *     happens AFTER the invalidation's refetches settled (a new args variant, an enabled flip) is
 *     gated exactly like its concurrent siblings — delivery is deterministic, not ordering luck;
 *   - chain-pinned reads: `chainId` alone guards a read to that chain; with its own `publicClient`
 *     the read is served through that client wherever the wallet sits (or with none), keyed under
 *     the pinned chain; ACP gating and decryption follow the read's chain; a write's block-aware
 *     refresh covers only the targets on its own chain.
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
  type PublicClient,
} from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { hardhat as hardhatCofheChain } from '@cofhe/sdk/chains';
import { acpStore } from '@cofhe/sdk/acps';
import { createCofheClient } from '@cofhe/sdk/web';
import { simpleTestAbi } from '@cofhe/test-setup';
import {
  CofheProvider,
  createCofheConfig,
  constructCofheReadContractQueryForInvalidation,
  invalidateQueriesWithContext,
  useCofheReadContract,
  useCofheReadContractAndDecrypt,
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
/** A key NO read ever touches until the staggered scenario enables its reader. */
const LATE_KEY = 9n;
/** A chain the provider is NOT connected to — presented by a second client over the same Anvil. */
const PINNED_CHAIN_ID = 31338;

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
  // Singular read of key 2 — the write target in the receipt-derived test. Shares
  // the batch entry's cache, so a narrowed invalidation must refresh both at once.
  const single2 = useCofheReadContract({
    address: contractAddress,
    abi: storeAbi,
    functionName: 'getItem',
    args: [KEYS[1]],
    requiresACP: false,
  });
  // The STAGGERED reader: disabled until a button enables it, so its first fetch
  // happens long after an invalidation's own refetches settled — a brand-new
  // cache entry under the invalidated prefix that the watermark must still gate.
  const [showLate, setShowLate] = React.useState(false);
  const late = useCofheReadContract(
    {
      address: contractAddress,
      abi: storeAbi,
      functionName: 'getItem',
      args: [LATE_KEY],
      requiresACP: false,
    },
    { enabled: showLate }
  );
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
      <output aria-label="single item 2">{single2.data === undefined ? '' : single2.data.toString()}</output>
      <output aria-label="late item">{late.data === undefined ? '' : late.data.toString()}</output>
      <output aria-label="tx hash">{txHash ?? ''}</output>
      <button onClick={() => setShowLate(true)}>mount late</button>
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

/**
 * `getItem(KEYS[0])` pinned to `chainId` — alone (guarded to that chain) or served through its own
 * client — rendered under a label prefix so several can share one screen.
 */
function PinnedRead({
  label,
  contractAddress,
  chainId,
  publicClient,
  requiresACP = false,
}: {
  label: string;
  contractAddress: Address;
  chainId: number;
  publicClient?: PublicClient;
  requiresACP?: boolean;
}) {
  const read = useCofheReadContract({
    address: contractAddress,
    abi: storeAbi,
    functionName: 'getItem',
    args: [KEYS[0]],
    requiresACP,
    ...(publicClient ? { chainId, publicClient } : { chainId }),
  });
  return (
    <>
      <output aria-label={`${label} value`}>{read.data === undefined ? '' : read.data.toString()}</output>
      <output aria-label={`${label} wrong chain`}>{String(read.disabledDueToWrongChain)}</output>
      <output aria-label={`${label} missing acp`}>{String(read.disabledDueToMissingValidACP)}</output>
    </>
  );
}

/** The batch hook pinned the same way, over the same call as `PinnedRead` — so they share a cache entry. */
function PinnedBatch({
  contractAddress,
  chainId,
  publicClient,
}: {
  contractAddress: Address;
  chainId: number;
  publicClient: PublicClient;
}) {
  const batch = useCofheReadContracts({
    contracts: [{ address: contractAddress, abi: storeAbi, functionName: 'getItem', args: [KEYS[0]] }],
    chainId,
    publicClient,
  });
  const item = batch.data?.[0];
  return <output aria-label="batch value">{item?.result === undefined ? '' : String(item.result)}</output>;
}

/** Read-and-decrypt of SimpleTest's encrypted value, pinned to `chainId` through its own client. */
function PinnedDecrypt({
  contractAddress,
  chainId,
  publicClient,
}: {
  contractAddress: Address;
  chainId: number;
  publicClient: PublicClient;
}) {
  const { decrypted } = useCofheReadContractAndDecrypt({
    address: contractAddress,
    abi: simpleTestAbi,
    functionName: 'getValue',
    chainId,
    publicClient,
  });
  return (
    <>
      <output aria-label="decrypted value">{decrypted.data === undefined ? '' : String(decrypted.data)}</output>
      <output aria-label="decrypt error">{decrypted.error?.message ?? ''}</output>
    </>
  );
}

/**
 * One write on the connected chain whose `invalidates` names the same call on BOTH chains: the
 * connected read and a read pinned to another chain through its own client.
 */
function CrossChainWriteApp({
  contractAddress,
  pinnedClient,
  writeValue,
}: {
  contractAddress: Address;
  pinnedClient: PublicClient;
  writeValue: bigint;
}) {
  const { writeContract, data: txHash } = useCofheWriteContract({
    invalidates: [
      { address: contractAddress, functionName: 'getItem' },
      { address: contractAddress, functionName: 'getItem', chainId: PINNED_CHAIN_ID },
    ],
  });
  return (
    <main>
      <PinnedRead label="connected" contractAddress={contractAddress} chainId={CHAIN_ID} />
      <PinnedRead
        label="pinned"
        contractAddress={contractAddress}
        chainId={PINNED_CHAIN_ID}
        publicClient={pinnedClient}
      />
      <output aria-label="tx hash">{txHash ?? ''}</output>
      <button
        onClick={() =>
          writeContract({
            address: contractAddress,
            abi: storeAbi,
            functionName: 'setItem',
            args: [KEYS[0], writeValue],
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

// Provided only when the Hardhat (Anvil) chain is selected — on testnet-only runs
// (e.g. the sepolia CI legs) globalSetup boots no Anvil and the suite skips itself.
const KEY_VALUE_STORE_ADDRESS = inject('anvilSimpleKeyValueStore') as Address;
const SIMPLE_TEST_ADDRESS = inject('anvilSimpleTest') as Address;

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
  single2: screen.getByRole('status', { name: 'single item 2' }).textContent,
  late: screen.getByRole('status', { name: 'late item' }).textContent,
  txHash: screen.getByRole('status', { name: 'tx hash' }).textContent,
});

const everyItemLoaded = () =>
  onScreen().items.every((item) => item !== '') && onScreen().single !== '' && onScreen().single2 !== '';

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
    // The invalidation context is a TTL watermark — it persists after delivery,
    // so any later fetch under the prefix stays gated too.
    expect(Object.keys(useInvalidationContextStore.getState().byKey)).not.toHaveLength(0);
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

    // Only the written key's entry refreshes — and the SINGULAR read of the same
    // call updates with it, from the same shared cache entry...
    await waitFor(() => expect(onScreen().items[1]).toBe('999'), EVENTUALLY);
    await waitFor(() => expect(onScreen().single2).toBe('999'), EVENTUALLY);
    // ...via exactly ONE refetch — keys 1 and 3 (and key 1's singular read) untouched...
    expect(recorder.countEthCalls(GET_ITEM_SELECTOR)).toBe(KEYS.length + 1);
    // ...block-gated; the watermark persists (TTL-bound) for later fetches.
    expect(recorder.countBlockHashProbes(receipt.blockHash)).toBe(1);
    expect(Object.keys(useInvalidationContextStore.getState().byKey)).not.toHaveLength(0);
  }, 180_000);

  it('the watermark gates a STAGGERED read — first fetched only after the invalidation settled', async () => {
    const { contractAddress, recorder, publicClient, renderApp } = setup();
    renderApp({ invalidates: [{ address: contractAddress, functionName: 'getItem' }], writeKey: 2n, writeValue: 555n });

    await waitFor(() => expect(everyItemLoaded()).toBe(true), EVENTUALLY);
    expect(recorder.countEthCalls(GET_ITEM_SELECTOR)).toBe(KEYS.length);

    fireEvent.click(screen.getByRole('button', { name: 'set item' }));
    await waitFor(() => expect(onScreen().txHash).toMatch(/^0x/), EVENTUALLY);
    const receipt = await publicClient.waitForTransactionReceipt({ hash: onScreen().txHash as Hash });
    expect(receipt.status).toBe('success');

    // Let the invalidation-driven refetches fully settle first…
    await waitFor(() => expect(onScreen().items[1]).toBe('555'), EVENTUALLY);
    await waitFor(() => expect(recorder.countEthCalls(GET_ITEM_SELECTOR)).toBe(KEYS.length * 2), EVENTUALLY);
    const probesBefore = recorder.countBlockHashProbes(receipt.blockHash);
    expect(probesBefore).toBeGreaterThanOrEqual(1);

    // …then enable a read that has NEVER fetched: a new args variant under the
    // invalidated prefix. Consume-on-first-delivery left it un-gated (ordering
    // luck); the TTL watermark must gate it exactly like its concurrent siblings.
    fireEvent.click(screen.getByRole('button', { name: 'mount late' }));
    await waitFor(() => expect(onScreen().late).toBe('0'), EVENTUALLY);
    expect(recorder.countBlockHashProbes(receipt.blockHash)).toBe(probesBefore + 1);
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

/** Read the on-screen outputs of the `PinnedRead` labelled `label`. */
const pinnedOnScreen = (label: string) => ({
  value: screen.getByRole('status', { name: `${label} value` }).textContent,
  wrongChain: screen.getByRole('status', { name: `${label} wrong chain` }).textContent,
  missingAcp: screen.getByRole('status', { name: `${label} missing acp` }).textContent,
});

/**
 * Two recording transports over the same Anvil: the CONNECTED client (31337) and a second client
 * presented as another chain (PINNED_CHAIN_ID). Chain identity itself is the app's promise; what
 * these tests pin down is which client serves which read, under which key, gated by which ACP.
 */
function setupPinned({ withWallet = true }: { withWallet?: boolean } = {}) {
  const contractAddress = KEY_VALUE_STORE_ADDRESS;
  const recorderMain = createRecordingProvider(ANVIL_RPC);
  const publicClient = createPublicClient({ chain: anvilChain, transport: custom(recorderMain) });
  const walletClient = createWalletClient({
    chain: anvilChain,
    transport: custom(recorderMain),
    account: TEST_ACCOUNT,
  });
  const recorderPinned = createRecordingProvider(ANVIL_RPC);
  const pinnedChain: Chain = defineChain({ ...anvilChain, id: PINNED_CHAIN_ID, name: 'Pinned' });
  const pinnedClient = createPublicClient({ chain: pinnedChain, transport: custom(recorderPinned) });
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const config = createCofheConfig({ supportedChains: [hardhatCofheChain], react: { autogenerateACPs: false } });
  // Created here rather than inside the provider so the tests can issue ACPs through it.
  const cofheClient = createCofheClient(config);

  const renderPinned = (children: React.ReactNode) =>
    render(
      <CofheProvider
        cofheClient={cofheClient}
        queryClient={queryClient}
        {...(withWallet ? { publicClient, walletClient } : {})}
      >
        {children}
      </CofheProvider>
    );

  return {
    contractAddress,
    recorderMain,
    recorderPinned,
    publicClient,
    walletClient,
    pinnedClient,
    queryClient,
    cofheClient,
    renderPinned,
  };
}

describeOnAnvil('react hooks: chain-pinned reads (Anvil)', () => {
  afterEach(() => {
    acpStore.resetStore();
  });

  it('chainId alone guards the read: on the connected chain it reads, on another it stays disabled', async () => {
    const { contractAddress, recorderMain, recorderPinned, renderPinned } = setupPinned();
    renderPinned(
      <>
        <PinnedRead label="here" contractAddress={contractAddress} chainId={CHAIN_ID} />
        <PinnedRead label="elsewhere" contractAddress={contractAddress} chainId={PINNED_CHAIN_ID} />
      </>
    );

    // Pinned to the connected chain: an ordinary read through the connected client.
    await waitFor(() => expect(pinnedOnScreen('here').value).not.toBe(''), EVENTUALLY);
    expect(pinnedOnScreen('here').wrongChain).toBe('false');

    // Pinned to another chain with no client of its own: the connected client is on the wrong
    // chain to serve it, so it is flagged and never fetched.
    expect(pinnedOnScreen('elsewhere').wrongChain).toBe('true');
    await sleep(500);
    expect(pinnedOnScreen('elsewhere').value).toBe('');
    expect(recorderMain.countEthCalls(GET_ITEM_SELECTOR)).toBe(1);
    expect(recorderPinned.calls).toHaveLength(0);
  }, 180_000);

  it('with its own publicClient a pinned read and batch fetch only through it, keyed under the pinned chain', async () => {
    const { contractAddress, recorderMain, recorderPinned, pinnedClient, queryClient, renderPinned } = setupPinned();
    renderPinned(
      <>
        <PinnedRead
          label="pinned"
          contractAddress={contractAddress}
          chainId={PINNED_CHAIN_ID}
          publicClient={pinnedClient}
        />
        <PinnedBatch contractAddress={contractAddress} chainId={PINNED_CHAIN_ID} publicClient={pinnedClient} />
      </>
    );

    await waitFor(() => expect(pinnedOnScreen('pinned').value).not.toBe(''), EVENTUALLY);
    await waitFor(
      () => expect(screen.getByRole('status', { name: 'batch value' }).textContent).not.toBe(''),
      EVENTUALLY
    );
    expect(pinnedOnScreen('pinned').wrongChain).toBe('false');

    // One fetch, through the pinned client only — the batch entry and the singular read are the
    // same call on the same chain, so they share one cache entry.
    expect(recorderPinned.countEthCalls(GET_ITEM_SELECTOR)).toBe(1);
    expect(recorderMain.countEthCalls(GET_ITEM_SELECTOR)).toBe(0);
    // The key carries the pinned chain id, so chainId-pinned invalidation targets meet it.
    const cachedKeys = queryClient
      .getQueryCache()
      .getAll()
      .map((query) => query.queryKey);
    expect(cachedKeys.some((key) => key[0] === 'cofheReadContract' && key[1] === PINNED_CHAIN_ID)).toBe(true);
  }, 180_000);

  it('a publicClient whose own chain disagrees with chainId keeps the read disabled', async () => {
    const { contractAddress, recorderMain, publicClient, renderPinned } = setupPinned();
    // The CONNECTED client (31337) handed to a read pinned to PINNED_CHAIN_ID.
    renderPinned(
      <PinnedRead
        label="mismatch"
        contractAddress={contractAddress}
        chainId={PINNED_CHAIN_ID}
        publicClient={publicClient}
      />
    );

    await waitFor(() => expect(pinnedOnScreen('mismatch').wrongChain).toBe('true'), EVENTUALLY);
    await sleep(500);
    expect(pinnedOnScreen('mismatch').value).toBe('');
    expect(recorderMain.countEthCalls(GET_ITEM_SELECTOR)).toBe(0);
  }, 180_000);

  it('a read with its own client runs with no wallet connected', async () => {
    const { contractAddress, recorderMain, recorderPinned, pinnedClient, cofheClient, renderPinned } = setupPinned({
      withWallet: false,
    });
    renderPinned(
      <PinnedRead
        label="walletless"
        contractAddress={contractAddress}
        chainId={PINNED_CHAIN_ID}
        publicClient={pinnedClient}
      />
    );

    await waitFor(() => expect(pinnedOnScreen('walletless').value).not.toBe(''), EVENTUALLY);
    expect(cofheClient.connected).toBe(false);
    expect(recorderPinned.countEthCalls(GET_ITEM_SELECTOR)).toBe(1);
    expect(recorderMain.calls).toHaveLength(0);
  }, 180_000);

  it("ACP gating follows the read's chain, not the connected one", async () => {
    const { contractAddress, recorderPinned, pinnedClient, cofheClient, renderPinned } = setupPinned();
    renderPinned(
      <>
        <PinnedRead label="here" contractAddress={contractAddress} chainId={CHAIN_ID} requiresACP />
        <PinnedRead
          label="pinned"
          contractAddress={contractAddress}
          chainId={PINNED_CHAIN_ID}
          publicClient={pinnedClient}
          requiresACP
        />
      </>
    );
    await waitFor(() => expect(cofheClient.connected).toBe(true), EVENTUALLY);
    const account = cofheClient.getSnapshot().account!;

    // An ACP on the CONNECTED chain only: the connected read runs, the pinned one stays gated.
    const acp = await cofheClient.acp.createSelf({ issuer: account, name: 'pinned-read test' });
    await waitFor(() => expect(pinnedOnScreen('here').value).not.toBe(''), EVENTUALLY);
    expect(pinnedOnScreen('pinned').missingAcp).toBe('true');
    expect(recorderPinned.countEthCalls(GET_ITEM_SELECTOR)).toBe(0);

    // The same ACP in the PINNED chain's slot: now the pinned read runs, through its own client.
    acpStore.setACP(PINNED_CHAIN_ID, account, acp);
    acpStore.setActiveACPHash(PINNED_CHAIN_ID, account, acp.hash);
    await waitFor(() => expect(pinnedOnScreen('pinned').value).not.toBe(''), EVENTUALLY);
    expect(pinnedOnScreen('pinned').missingAcp).toBe('false');
    expect(recorderPinned.countEthCalls(GET_ITEM_SELECTOR)).toBe(1);
  }, 180_000);

  it("decryption follows the read's chain: the pinned chain's ACP decrypts the pinned value", async () => {
    const { publicClient, walletClient, pinnedClient, cofheClient, renderPinned } = setupPinned();
    // A nonzero encrypted value — a zero handle is a known zero, with nothing to decrypt.
    const hash = await walletClient.writeContract({
      address: SIMPLE_TEST_ADDRESS,
      abi: simpleTestAbi,
      functionName: 'setValueTrivial',
      args: [42n],
      account: TEST_ACCOUNT,
      chain: anvilChain,
    });
    await publicClient.waitForTransactionReceipt({ hash });

    renderPinned(
      <PinnedDecrypt contractAddress={SIMPLE_TEST_ADDRESS} chainId={PINNED_CHAIN_ID} publicClient={pinnedClient} />
    );
    await waitFor(() => expect(cofheClient.connected).toBe(true), EVENTUALLY);
    const account = cofheClient.getSnapshot().account!;

    // The ONLY ACP moves to the pinned chain's slot. With none on the connected chain, a decrypt
    // that followed the wallet could neither start (its gate) nor resolve an ACP (the builder).
    const acp = await cofheClient.acp.createSelf({ issuer: account, name: 'pinned-decrypt test' });
    acpStore.setACP(PINNED_CHAIN_ID, account, acp);
    acpStore.setActiveACPHash(PINNED_CHAIN_ID, account, acp.hash);
    acpStore.removeACP(CHAIN_ID, account, acp.hash);

    await waitFor(
      () => expect(screen.getByRole('status', { name: 'decrypted value' }).textContent).toBe('42'),
      EVENTUALLY
    );
    expect(screen.getByRole('status', { name: 'decrypt error' }).textContent).toBe('');
  }, 180_000);

  it('a write refreshes a target on ANOTHER chain plainly — only its own chain is block-aware', async () => {
    const { contractAddress, recorderMain, recorderPinned, publicClient, pinnedClient, renderPinned } = setupPinned();
    renderPinned(
      <CrossChainWriteApp contractAddress={contractAddress} pinnedClient={pinnedClient} writeValue={4242n} />
    );
    await waitFor(() => expect(pinnedOnScreen('connected').value).not.toBe(''), EVENTUALLY);
    await waitFor(() => expect(pinnedOnScreen('pinned').value).not.toBe(''), EVENTUALLY);

    fireEvent.click(screen.getByRole('button', { name: 'set item' }));
    const txHashOnScreen = () => screen.getByRole('status', { name: 'tx hash' }).textContent;
    await waitFor(() => expect(txHashOnScreen()).toMatch(/^0x/), EVENTUALLY);
    const receipt = await publicClient.waitForTransactionReceipt({ hash: txHashOnScreen() as Hash });
    expect(receipt.status).toBe('success');

    // Both reads refresh to the written value (both "chains" are the same Anvil)…
    await waitFor(() => expect(pinnedOnScreen('connected').value).toBe('4242'), EVENTUALLY);
    await waitFor(() => expect(pinnedOnScreen('pinned').value).toBe('4242'), EVENTUALLY);
    // …the connected one gated on the mined block, the pinned one plainly: its chain never
    // produced that block, so a gate there could only wait out its timeout.
    expect(recorderMain.countBlockHashProbes(receipt.blockHash)).toBe(1);
    expect(recorderPinned.countBlockHashProbes()).toBe(0);
    expect(recorderPinned.countEthCalls(GET_ITEM_SELECTOR)).toBe(2);
  }, 180_000);
});
