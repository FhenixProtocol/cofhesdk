/**
 * React hooks integration: a write's invalidation across chains, on a real chain.
 *
 * The rule: dirty every declared target, gate only the ones on the chain where the block exists.
 *
 * The setup, in one screen:
 *   - the wallet is on chain A; a second read of the SAME contract call is pinned to chain B
 *     through its own publicClient;
 *   - one write on chain A declares `invalidates` covering both reads;
 *   - after the tx mines, BOTH reads must refresh — but only the chain-A read may wait for the
 *     mined block. Chain B's node will never see that block, so waiting there is pure harm: up to
 *     a full wait window of `isFetching` per fetch, for the whole watermark TTL.
 *
 * Chain B is played by a client over the same Anvil whose transport answers `null` to every
 * eth_getBlockByHash — a node that never learns chain A's blocks, i.e. a real other chain.
 *
 * Both target forms below must behave the same: per-chain descriptors (the hook reads the chain off
 * each one), and a raw prefix spanning every chain (the hook gates the mined chain's slice only).
 */
import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { describe, expect, inject, it } from 'vitest';
import { QueryClient } from '@tanstack/react-query';
import { createPublicClient, createWalletClient, custom, defineChain, type Address, type Chain, type Hash } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { hardhat as hardhatCofheChain } from '@cofhe/sdk/chains';
import {
  CofheProvider,
  createCofheConfig,
  useCofheReadContract,
  useCofheWriteContract,
  useInvalidationContextStore,
  type CofheWriteInvalidates,
} from '@cofhe/react';

const ANVIL_RPC = 'http://127.0.0.1:8546';
const CHAIN_A = 31337; // the connected chain (Anvil)
const CHAIN_B = 31338; // "another chain": same Anvil, different id, never knows chain A's blocks
// Anvil default account #6 — dedicated, so this file cannot race the other suites' nonces.
const ACCOUNT = privateKeyToAccount('0x92db14e403b83dfe3df233f83dfa3a0d7096f21ca9b0d6d6b8d88b2b4ec1564e');
const KEY = 78n;

const chainA: Chain = defineChain({
  id: CHAIN_A,
  name: 'A',
  nativeCurrency: { name: 'Ether', symbol: 'ETH', decimals: 18 },
  rpcUrls: { default: { http: [ANVIL_RPC] } },
});
const chainB: Chain = defineChain({ ...chainA, id: CHAIN_B, name: 'B' });

/** SimpleKeyValueStore: uint256 => uint256. */
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

/** EIP-1193 transport over fetch that counts block-hash probes; `otherChain` never knows any block. */
function transport({ otherChain = false } = {}) {
  let id = 0;
  let probes = 0;
  const request = async ({ method, params }: { method: string; params?: unknown }) => {
    if (method === 'eth_getBlockByHash') {
      probes += 1;
      if (otherChain) return null;
    }
    const res = await fetch(ANVIL_RPC, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ jsonrpc: '2.0', id: ++id, method, params: params ?? [] }),
    });
    const json = (await res.json()) as { result?: unknown; error?: { message: string } };
    if (json.error) throw new Error(`RPC ${method} failed: ${json.error.message}`);
    return json.result;
  };
  return { request, probes: () => probes };
}

const CONTRACT = inject('anvilSimpleKeyValueStore') as Address;

function App({
  clientB,
  invalidates,
  value,
}: {
  clientB: ReturnType<typeof createPublicClient>;
  invalidates: CofheWriteInvalidates;
  value: bigint;
}) {
  const read = { address: CONTRACT, abi: storeAbi, functionName: 'getItem', args: [KEY], requiresACP: false } as const;
  const onA = useCofheReadContract(read);
  const onB = useCofheReadContract({ ...read, chainId: CHAIN_B, publicClient: clientB });
  const { writeContract, data: txHash } = useCofheWriteContract({ invalidates });
  return (
    <main>
      <output aria-label="A">{onA.data?.toString() ?? ''}</output>
      <output aria-label="B">{onB.data?.toString() ?? ''}</output>
      <output aria-label="tx">{txHash ?? ''}</output>
      <button
        onClick={() =>
          writeContract({
            address: CONTRACT,
            abi: storeAbi,
            functionName: 'setItem',
            args: [KEY, value],
            account: ACCOUNT,
            chain: chainA,
          })
        }
      >
        write
      </button>
    </main>
  );
}

const shown = (label: string) => screen.getByRole('status', { name: label }).textContent;

/** Renders the app, fires the write, waits for it to mine. Returns the transports + the written value. */
async function writeWith(invalidates: CofheWriteInvalidates) {
  useInvalidationContextStore.setState({ byKey: {} });
  const a = transport();
  const b = transport({ otherChain: true });
  const publicClient = createPublicClient({ chain: chainA, transport: custom(a) });
  const walletClient = createWalletClient({ chain: chainA, transport: custom(a), account: ACCOUNT });
  const clientB = createPublicClient({ chain: chainB, transport: custom(b) });
  const value = BigInt(Date.now());

  render(
    <CofheProvider
      config={createCofheConfig({ supportedChains: [hardhatCofheChain], react: { autogenerateACPs: false } })}
      queryClient={new QueryClient({ defaultOptions: { queries: { retry: false } } })}
      publicClient={publicClient}
      walletClient={walletClient}
    >
      <App clientB={clientB} invalidates={invalidates} value={value} />
    </CofheProvider>
  );
  await waitFor(() => expect(shown('B')).not.toBe(''), { timeout: 30_000 });

  fireEvent.click(screen.getByRole('button', { name: 'write' }));
  await waitFor(() => expect(shown('tx')).toMatch(/^0x/), { timeout: 30_000 });
  await publicClient.waitForTransactionReceipt({ hash: shown('tx') as Hash });
  return { a, b, value: value.toString() };
}

/** The rule, whatever form the targets take. */
async function expectOnlyChainAIsGated({ a, b, value }: Awaited<ReturnType<typeof writeWith>>) {
  // Both reads refresh — B promptly, because nothing may be waiting there.
  await waitFor(() => expect(shown('A')).toBe(value), { timeout: 30_000 });
  await waitFor(() => expect(shown('B')).toBe(value), { timeout: 5_000 });
  // A's node was asked about the mined block; B's node never was.
  expect(a.probes()).toBeGreaterThanOrEqual(1);
  expect(b.probes()).toBe(0);
}

const describeOnAnvil = CONTRACT ? describe : describe.skip;

describeOnAnvil('react hooks: a write never gates a read pinned to another chain (Anvil)', () => {
  it('per-chain descriptors: each names its chain, so the hook gates A and refreshes B plainly', async () => {
    // One descriptor per chain: a descriptor is a key prefix and chainId fills its chain slot
    // (omitted = the connected chain), so each one reaches exactly one of the two reads.
    const run = await writeWith([
      { address: CONTRACT, functionName: 'getItem' },
      { address: CONTRACT, functionName: 'getItem', chainId: CHAIN_B },
    ]);
    await expectOnlyChainAIsGated(run);
  }, 120_000);

  it('a raw prefix spanning every chain: dirtied everywhere, gated on the mined chain’s slice only', async () => {
    const run = await writeWith([['cofheReadContract']]);
    await expectOnlyChainAIsGated(run);
  }, 120_000);
});
