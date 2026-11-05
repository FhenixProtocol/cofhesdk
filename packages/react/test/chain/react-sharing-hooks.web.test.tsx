/**
 * React hooks integration: the sharing hooks, end to end on a real chain.
 *
 * Bob (issuer) posts a share with `useCofheShareOnChain`. Alice (recipient) sees it in
 * `useCofheIncomingShares`, imports it with `useCofheImportShared({ activate: false })` so her own ACP
 * stays active, and the inbox then excludes it. `useCofheACPStatus` reports the share as valid on both
 * sides; when Bob revokes it with `useCofheRevokeACP` his status re-reads to revoked at once. Alice
 * dismisses the registry entry with `useCofheRemoveShare`.
 */
import React, { useEffect, useState } from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, inject, it } from 'vitest';
import { QueryClient } from '@tanstack/react-query';
import {
  createPublicClient,
  createWalletClient,
  custom,
  defineChain,
  parseAbi,
  toFunctionSelector,
  type Address,
  type Chain,
  type Hex,
} from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { hardhat as hardhatCofheChain } from '@cofhe/sdk/chains';
import { acpStore, type ACP, type IncomingShare, type ShareLabel } from '@cofhe/sdk/acps';
import { createCofheClient } from '@cofhe/sdk/web';
import {
  CofheProvider,
  createCofheConfig,
  useCofheACPStatus,
  useCofheImportShared,
  useCofheIncomingShares,
  useCofheRemoveShare,
  useCofheRevokeACP,
  useCofheShareLabels,
  useCofheShareOnChain,
} from '@cofhe/react';

const ANVIL_RPC = 'http://127.0.0.1:8546';
// Anvil default accounts #8 (Bob, issuer) and #9 (Alice, recipient); the suites run one file at a time.
const BOB = privateKeyToAccount('0xdbda1821b80551c9d65939329250298aa3472ba22feea921c0cf5d620ea67b97');
const ALICE = privateKeyToAccount('0x2a871d0798f97d79848a013d4936a73bf4cc922c825d33c1cf7073dff6d409c6');

const chain: Chain = defineChain({
  id: 31337,
  name: 'Anvil',
  nativeCurrency: { name: 'Ether', symbol: 'ETH', decimals: 18 },
  rpcUrls: { default: { http: [ANVIL_RPC] } },
});
const SIMPLE_TEST = inject('anvilSimpleTest') as Address;
const SHARE_REGISTRY = inject('anvilAcpShareRegistry') as Address;

/** A plain EIP-1193 transport over fetch. */
function transport() {
  let id = 0;
  return {
    request: async ({ method, params }: { method: string; params?: unknown }) => {
      const res = await fetch(ANVIL_RPC, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ jsonrpc: '2.0', id: ++id, method, params: params ?? [] }),
      });
      const json = (await res.json()) as { result?: unknown; error?: { message: string } };
      if (json.error) throw new Error(`RPC ${method} failed: ${json.error.message}`);
      return json.result;
    },
  };
}

function Issuer({ acp }: { acp: ACP }) {
  const share = useCofheShareOnChain();
  const revoke = useCofheRevokeACP();
  const { status } = useCofheACPStatus(acp);
  return (
    <>
      <button onClick={() => share.mutate(acp)}>share</button>
      <button onClick={() => revoke.mutate(acp)}>revoke</button>
      <output aria-label="share result">{share.data?.shareId ?? (share.error ? share.error.message : '')}</output>
      <output aria-label="revoke result">{revoke.data ?? (revoke.error ? revoke.error.message : '')}</output>
      <output aria-label="issuer status">{status}</output>
    </>
  );
}

function Recipient() {
  const incoming = useCofheIncomingShares({ refetchIntervalMs: 1_000 });
  const importShare = useCofheImportShared({ activate: false });
  const remove = useCofheRemoveShare();
  const first = incoming.data?.[0];
  // The inbox drops a share once imported; keep the one we saw so it can be dismissed afterwards.
  const [seen, setSeen] = useState<IncomingShare>();
  useEffect(() => {
    if (first) setSeen(first);
  }, [first]);
  const { status } = useCofheACPStatus(importShare.data?.hash);
  return (
    <>
      <output aria-label="incoming">{incoming.data ? String(incoming.data.length) : ''}</output>
      <button onClick={() => first && importShare.mutate(first)}>import</button>
      <output aria-label="imported">
        {importShare.data?.hash ?? (importShare.error ? importShare.error.message : '')}
      </output>
      <output aria-label="recipient status">{status}</output>
      <button onClick={() => seen && remove.mutate(seen.shareId)}>dismiss</button>
      <output aria-label="dismissed">{remove.isSuccess ? 'yes' : remove.error ? remove.error.message : ''}</output>
    </>
  );
}

const SIMPLE_TEST_ABI = parseAbi([
  'function setValueTrivial(uint256 inValue)',
  'function getValueHash() view returns (bytes32)',
]);

function LabellingIssuer({ acp, labels }: { acp: ACP; labels: ShareLabel[] }) {
  const share = useCofheShareOnChain();
  return (
    <>
      <button onClick={() => share.mutate({ acp, labels })}>share labelled</button>
      <output aria-label="labelled share result">
        {share.data?.shareId ?? (share.error ? share.error.message : '')}
      </output>
    </>
  );
}

function LabelReader() {
  const incoming = useCofheIncomingShares({ refetchIntervalMs: 1_000 });
  const { labels } = useCofheShareLabels(incoming.data?.[0], { abis: { [SIMPLE_TEST]: SIMPLE_TEST_ABI } });
  return (
    <output aria-label="labels">
      {labels?.map((l) => `${l.kind === 'stored' ? l.function?.name : l.kind}:${l.check}`).join(' ') ?? ''}
    </output>
  );
}

const shown = (label: string) => screen.getByRole('status', { name: label }).textContent;
const click = (name: string) => fireEvent.click(screen.getByRole('button', { name }));

afterEach(() => acpStore.resetStore());

const describeOnAnvil = SIMPLE_TEST && SHARE_REGISTRY ? describe : describe.skip;

describeOnAnvil('react hooks: on-chain sharing (Anvil)', () => {
  it('share, discover, import without activating, status, revoke, dismiss', async () => {
    const publicClient = createPublicClient({ chain, transport: custom(transport()) });
    const bobWallet = createWalletClient({ chain, transport: custom(transport()), account: BOB });
    const aliceWallet = createWalletClient({ chain, transport: custom(transport()), account: ALICE });
    const config = createCofheConfig({
      supportedChains: [hardhatCofheChain],
      react: { autogenerateACPs: false },
      acp: { sharingRegistry: { 31337: SHARE_REGISTRY } },
    });

    const bobClient = createCofheClient(config);
    await bobClient.connect(publicClient, bobWallet);
    const sharing = await bobClient.acp.createSharing({ issuer: BOB.address, recipient: ALICE.address, name: 'hooks' });

    const aliceClient = createCofheClient(config);
    await aliceClient.connect(publicClient, aliceWallet);
    const own = await aliceClient.acp.createSelf({ issuer: ALICE.address, name: 'Alice own' });

    render(
      <>
        <CofheProvider
          cofheClient={bobClient}
          queryClient={new QueryClient()}
          publicClient={publicClient}
          walletClient={bobWallet}
        >
          <Issuer acp={sharing} />
        </CofheProvider>
        <CofheProvider
          cofheClient={aliceClient}
          queryClient={new QueryClient()}
          publicClient={publicClient}
          walletClient={aliceWallet}
        >
          <Recipient />
        </CofheProvider>
      </>
    );

    // Nothing shared yet.
    await waitFor(() => expect(shown('incoming')).toBe('0'), { timeout: 30_000 });
    await waitFor(() => expect(shown('issuer status')).toBe('valid'), { timeout: 30_000 });

    // Bob posts the share; Alice discovers it.
    click('share');
    await waitFor(() => expect(shown('share result')).toMatch(/^0x[0-9a-f]{64}$/), { timeout: 60_000 });
    await waitFor(() => expect(shown('incoming')).toBe('1'), { timeout: 30_000 });

    // Alice imports without activating: her own ACP stays active, the inbox no longer lists the share.
    click('import');
    await waitFor(() => expect(shown('imported')).toMatch(/^0x/), { timeout: 60_000 });
    expect(aliceClient.acp.getActiveACPHash()).toBe(own.hash);
    await waitFor(() => expect(shown('incoming')).toBe('0'), { timeout: 30_000 });
    await waitFor(() => expect(shown('recipient status')).toBe('valid'), { timeout: 30_000 });

    // Alice dismisses the registry entry (it stays on-chain until removed).
    click('dismiss');
    await waitFor(() => expect(shown('dismissed')).toBe('yes'), { timeout: 60_000 });
    expect(await aliceClient.acp.getIncomingShares()).toHaveLength(0);

    // Bob revokes: his status re-reads at once, without waiting for the periodic check.
    click('revoke');
    await waitFor(() => expect(shown('revoke result')).toMatch(/^0x/), { timeout: 60_000 });
    await waitFor(() => expect(shown('issuer status')).toBe('revoked'), { timeout: 30_000 });
  }, 180_000);

  it('a labelled SNAPSHOT share: posted with its labels, described and verified by the recipient', async () => {
    const publicClient = createPublicClient({ chain, transport: custom(transport()) });
    const bobWallet = createWalletClient({ chain, transport: custom(transport()), account: BOB });
    const aliceWallet = createWalletClient({ chain, transport: custom(transport()), account: ALICE });
    const config = createCofheConfig({
      supportedChains: [hardhatCofheChain],
      react: { autogenerateACPs: false },
      acp: { sharingRegistry: { 31337: SHARE_REGISTRY } },
    });

    // Bob stores a value; the label says it is what getValueHash() returned at that block.
    const hash = await bobWallet.writeContract({
      address: SIMPLE_TEST,
      abi: SIMPLE_TEST_ABI,
      functionName: 'setValueTrivial',
      args: [7n],
    });
    const { blockNumber } = await publicClient.waitForTransactionReceipt({ hash });
    const ctHash = await publicClient.readContract({
      address: SIMPLE_TEST,
      abi: SIMPLE_TEST_ABI,
      functionName: 'getValueHash',
      blockNumber,
    });
    const read: ShareLabel = {
      kind: 'stored',
      contract: SIMPLE_TEST,
      selector: toFunctionSelector('getValueHash()'),
      args: [],
      returnWord: 0,
      block: blockNumber,
    };
    // The second handle claims the same read, which did not return it: a lie the check catches.
    const other: Hex = `0x${'0'.repeat(63)}1`;

    const bobClient = createCofheClient(config);
    await bobClient.connect(publicClient, bobWallet);
    const sharing = await bobClient.acp.createSharing({
      issuer: BOB.address,
      recipient: ALICE.address,
      name: 'labelled',
      handles: [ctHash, other],
    });
    const aliceClient = createCofheClient(config);
    await aliceClient.connect(publicClient, aliceWallet);

    render(
      <>
        <CofheProvider
          cofheClient={bobClient}
          queryClient={new QueryClient()}
          publicClient={publicClient}
          walletClient={bobWallet}
        >
          <LabellingIssuer acp={sharing} labels={[read, read]} />
        </CofheProvider>
        <CofheProvider
          cofheClient={aliceClient}
          queryClient={new QueryClient()}
          publicClient={publicClient}
          walletClient={aliceWallet}
        >
          <LabelReader />
        </CofheProvider>
      </>
    );

    click('share labelled');
    await waitFor(() => expect(shown('labelled share result')).toMatch(/^0x[0-9a-f]{64}$/), { timeout: 60_000 });
    await waitFor(() => expect(shown('labels')).toBe('getValueHash:verified getValueHash:mismatch'), {
      timeout: 30_000,
    });

    await aliceClient.acp.dismissShare(shown('labelled share result') as Hex);
  }, 180_000);
});
