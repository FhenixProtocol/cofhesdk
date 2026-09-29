/**
 * React hooks integration: decrypting with a shared ACP inside `<CofheACPScope>`, on a real chain.
 *
 * Bob stores a value only he may decrypt and shares read access with Alice. Alice imports the share
 * without activating it, so her own self ACP stays active. Inside `<CofheACPScope acp={shared}>` the
 * read decrypts with the shared ACP and shows Bob's value, while a sibling outside the scope keeps
 * decrypting with Alice's active ACP, which is not allowed on that handle. A per-hook `acp` beats
 * the enclosing scope, and an expired scoped ACP gates the read without touching the active ACP.
 */
import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, inject, it } from 'vitest';
import { QueryClient } from '@tanstack/react-query';
import { createPublicClient, createWalletClient, custom, defineChain, type Address, type Chain } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { hardhat as hardhatCofheChain } from '@cofhe/sdk/chains';
import { acpStore } from '@cofhe/sdk/acps';
import { createCofheClient } from '@cofhe/sdk/web';
import { simpleTestAbi } from '@cofhe/test-setup';
import {
  CofheACPScope,
  useCofheACPScope,
  CofheProvider,
  createCofheConfig,
  useCofheACPs,
  useCofheReadContractAndDecrypt,
  type CofheACPInput,
} from '@cofhe/react';

const ANVIL_RPC = 'http://127.0.0.1:8546';
// Anvil default accounts #8 (Bob, the issuer) and #9 (Alice, the recipient) — dedicated, so this
// file cannot race the other suites' nonces.
const BOB = privateKeyToAccount('0xdbda1821b80551c9d65939329250298aa3472ba22feea921c0cf5d620ea67b97');
const ALICE = privateKeyToAccount('0x2a871d0798f97d79848a013d4936a73bf4cc922c825d33c1cf7073dff6d409c6');

const chain: Chain = defineChain({
  id: 31337,
  name: 'Anvil',
  nativeCurrency: { name: 'Ether', symbol: 'ETH', decimals: 18 },
  rpcUrls: { default: { http: [ANVIL_RPC] } },
});
const SIMPLE_TEST = inject('anvilSimpleTest') as Address;

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

function Decrypt({ label, acp }: { label: string; acp?: CofheACPInput }) {
  const { decrypted, isDecryptError, disabledDueToMissingValidACP, isOutOfScope } = useCofheReadContractAndDecrypt({
    address: SIMPLE_TEST,
    abi: simpleTestAbi,
    functionName: 'getValue',
    acp,
  });
  const text = disabledDueToMissingValidACP
    ? 'no valid acp'
    : isOutOfScope
      ? 'out of scope'
      : isDecryptError
        ? 'decrypt error'
        : decrypted.data === undefined
          ? ''
          : String(decrypted.data);
  return (
    <>
      <output aria-label={label}>{text}</output>
      <output aria-label={`${label} value`}>{decrypted.data === undefined ? '' : String(decrypted.data)}</output>
    </>
  );
}

/** How many ACPs the connected account has stored, in all and received (type recipient). */
function ACPCounts() {
  const all = useCofheACPs();
  const received = useCofheACPs({ type: 'recipient' });
  return <output aria-label="acp counts">{`${all.length} stored, ${received.length} received`}</output>;
}

/** The enclosing scope on-chain status. */
function ScopeStatus({ label }: { label: string }) {
  return <output aria-label={label}>{useCofheACPScope()?.status ?? 'no scope'}</output>;
}

const shown = (label: string) => screen.getByRole('status', { name: label }).textContent;

afterEach(() => acpStore.resetStore());

const describeOnAnvil = SIMPLE_TEST ? describe : describe.skip;

describeOnAnvil('react hooks: <CofheACPScope> decrypts with a shared ACP (Anvil)', () => {
  it('scoped reads use the shared ACP; the rest of the tree keeps the active one', async () => {
    const publicClient = createPublicClient({ chain, transport: custom(transport()) });
    const bobWallet = createWalletClient({ chain, transport: custom(transport()), account: BOB });
    const aliceWallet = createWalletClient({ chain, transport: custom(transport()), account: ALICE });
    const config = createCofheConfig({ supportedChains: [hardhatCofheChain], react: { autogenerateACPs: false } });
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });

    // Bob stores 42: allowed for Bob only.
    const hash = await bobWallet.writeContract({
      address: SIMPLE_TEST,
      abi: simpleTestAbi,
      functionName: 'setValueTrivial',
      args: [42n],
      account: BOB,
      chain,
    });
    await publicClient.waitForTransactionReceipt({ hash });

    // Bob shares with Alice.
    const bobClient = createCofheClient(config);
    await bobClient.connect(publicClient, bobWallet);
    const sharing = await bobClient.acp.createSharing({
      issuer: BOB.address,
      recipient: ALICE.address,
      name: 'Bob to Alice',
    });
    const exported = bobClient.acp.export(sharing);

    // Alice has her own active ACP and imports the share without activating it.
    const aliceClient = createCofheClient(config);
    await aliceClient.connect(publicClient, aliceWallet);
    const own = await aliceClient.acp.createSelf({ issuer: ALICE.address, name: 'Alice own' });
    const shared = await aliceClient.acp.importShared(exported, { activate: false });
    expect(aliceClient.acp.getActiveACPHash()).toBe(own.hash);

    render(
      <CofheProvider
        cofheClient={aliceClient}
        queryClient={queryClient}
        publicClient={publicClient}
        walletClient={aliceWallet}
      >
        <CofheACPScope acp={shared}>
          <Decrypt label="scoped" />
          <Decrypt label="override" acp={own.hash} />
        </CofheACPScope>
        <Decrypt label="own" />
        <ACPCounts />
        <CofheACPScope acp={{ ...shared, expiration: 1 }}>
          <Decrypt label="expired" />
        </CofheACPScope>
      </CofheProvider>
    );

    await waitFor(() => expect(shown('scoped')).toBe('42'), { timeout: 90_000 });
    await waitFor(() => expect(shown('own')).toBe('decrypt error'), { timeout: 90_000 });
    await waitFor(() => expect(shown('override')).toBe('decrypt error'), { timeout: 90_000 });
    expect(shown('expired')).toBe('no valid acp');
    // Alice stores her own ACP and the imported share.
    expect(shown('acp counts')).toBe('2 stored, 1 received');
    expect(aliceClient.acp.getActiveACPHash()).toBe(own.hash);

    // One ctHash, decrypted under two ACPs: the scoped entry carries the shared ACP's hash, so it
    // never answers the unscoped sibling.
    const decrypts = queryClient
      .getQueryCache()
      .findAll({ queryKey: ['decryptCiphertext'] })
      .filter((q) => q.queryKey[2] != null);
    const keyedByShared = decrypts.filter((q) => q.queryKey[4] === shared.hash);
    expect(keyedByShared).toHaveLength(1);
    expect(keyedByShared[0].state.data).toBe(42n);
  }, 180_000);

  it('shared-ACP decrypts are never persisted and go away with the ACP', async () => {
    const publicClient = createPublicClient({ chain, transport: custom(transport()) });
    const bobWallet = createWalletClient({ chain, transport: custom(transport()), account: BOB });
    const aliceWallet = createWalletClient({ chain, transport: custom(transport()), account: ALICE });
    const config = createCofheConfig({ supportedChains: [hardhatCofheChain], react: { autogenerateACPs: false } });
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });

    const hash = await bobWallet.writeContract({
      address: SIMPLE_TEST,
      abi: simpleTestAbi,
      functionName: 'setValueTrivial',
      args: [43n],
      account: BOB,
      chain,
    });
    await publicClient.waitForTransactionReceipt({ hash });

    // Two shares: one long-lived (removed by hand), one that expires in 20 seconds.
    const bobClient = createCofheClient(config);
    await bobClient.connect(publicClient, bobWallet);
    const longLived = await bobClient.acp.createSharing({
      issuer: BOB.address,
      recipient: ALICE.address,
      name: 'kept',
    });
    const shortLived = await bobClient.acp.createSharing({
      issuer: BOB.address,
      recipient: ALICE.address,
      name: 'expiring',
      expiration: Math.floor(Date.now() / 1000) + 20,
    });

    const aliceClient = createCofheClient(config);
    await aliceClient.connect(publicClient, aliceWallet);
    await aliceClient.acp.createSelf({ issuer: ALICE.address, name: 'Alice own' });
    const removable = await aliceClient.acp.importShared(bobClient.acp.export(longLived), { activate: false });
    const expiring = await aliceClient.acp.importShared(bobClient.acp.export(shortLived), { activate: false });

    render(
      <CofheProvider
        cofheClient={aliceClient}
        queryClient={queryClient}
        publicClient={publicClient}
        walletClient={aliceWallet}
      >
        <CofheACPScope acp={removable.hash}>
          <Decrypt label="removable" />
        </CofheACPScope>
        <CofheACPScope acp={expiring.hash}>
          <Decrypt label="expiring" />
        </CofheACPScope>
        <Decrypt label="own" />
      </CofheProvider>
    );

    await waitFor(() => expect(shown('removable')).toBe('43'), { timeout: 90_000 });
    await waitFor(() => expect(shown('expiring')).toBe('43'), { timeout: 90_000 });
    await waitFor(() => expect(shown('own')).toBe('decrypt error'), { timeout: 90_000 });

    const decryptsUnder = (acpHash: string | undefined) =>
      queryClient
        .getQueryCache()
        .findAll({ queryKey: ['decryptCiphertext'] })
        .filter((q) => q.queryKey[2] != null && q.queryKey[4] === acpHash);

    // Plaintext decrypted with a shared ACP stays in memory only; the user own decrypts still persist.
    expect(decryptsUnder(removable.hash)[0].meta?.persist).toBe(false);
    expect(decryptsUnder(undefined)[0].meta?.persist).toBe(true);

    // Nothing decrypted with an ACP may stay readable once the ACP is gone. (A still-mounted hook
    // may re-register an empty, disabled query under the same key; it holds no value.)
    const plaintextUnder = (acpHash: string) => decryptsUnder(acpHash).filter((q) => q.state.data !== undefined);

    // Removing the ACP drops what it decrypted.
    aliceClient.acp.removeACP(removable.hash);
    await waitFor(() => expect(plaintextUnder(removable.hash)).toHaveLength(0), { timeout: 10_000 });
    await waitFor(() => expect(shown('removable')).toBe('no valid acp'));
    expect(shown('removable value')).toBe('');

    // So does expiry, while the view stays mounted.
    await waitFor(() => expect(plaintextUnder(expiring.hash)).toHaveLength(0), { timeout: 40_000 });
    await waitFor(() => expect(shown('expiring')).toBe('no valid acp'));
    expect(shown('expiring value')).toBe('');
  }, 180_000);

  it('a shared ACP made active is not persisted either', async () => {
    const publicClient = createPublicClient({ chain, transport: custom(transport()) });
    const bobWallet = createWalletClient({ chain, transport: custom(transport()), account: BOB });
    const aliceWallet = createWalletClient({ chain, transport: custom(transport()), account: ALICE });
    const config = createCofheConfig({ supportedChains: [hardhatCofheChain], react: { autogenerateACPs: false } });
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });

    const hash = await bobWallet.writeContract({
      address: SIMPLE_TEST,
      abi: simpleTestAbi,
      functionName: 'setValueTrivial',
      args: [44n],
      account: BOB,
      chain,
    });
    await publicClient.waitForTransactionReceipt({ hash });

    const bobClient = createCofheClient(config);
    await bobClient.connect(publicClient, bobWallet);
    const sharing = await bobClient.acp.createSharing({
      issuer: BOB.address,
      recipient: ALICE.address,
      name: 'activated',
    });

    // The default import activates the share: every unscoped decrypt now uses it.
    const aliceClient = createCofheClient(config);
    await aliceClient.connect(publicClient, aliceWallet);
    const shared = await aliceClient.acp.importShared(bobClient.acp.export(sharing));
    expect(aliceClient.acp.getActiveACPHash()).toBe(shared.hash);

    render(
      <CofheProvider
        cofheClient={aliceClient}
        queryClient={queryClient}
        publicClient={publicClient}
        walletClient={aliceWallet}
      >
        <Decrypt label="active share" />
      </CofheProvider>
    );

    await waitFor(() => expect(shown('active share')).toBe('44'), { timeout: 90_000 });
    const decrypted = queryClient
      .getQueryCache()
      .findAll({ queryKey: ['decryptCiphertext'] })
      .filter((q) => q.queryKey[2] != null && q.state.data !== undefined);
    expect(decrypted).toHaveLength(1);
    expect(decrypted[0].meta?.persist).toBe(false);
  }, 180_000);
  it('a revoked share turns the scope off; a SNAPSHOT share flags values it does not cover', async () => {
    const publicClient = createPublicClient({ chain, transport: custom(transport()) });
    const bobWallet = createWalletClient({ chain, transport: custom(transport()), account: BOB });
    const aliceWallet = createWalletClient({ chain, transport: custom(transport()), account: ALICE });
    const config = createCofheConfig({ supportedChains: [hardhatCofheChain], react: { autogenerateACPs: false } });
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });

    const store = async (value: bigint) => {
      const hash = await bobWallet.writeContract({
        address: SIMPLE_TEST,
        abi: simpleTestAbi,
        functionName: 'setValueTrivial',
        args: [value],
        account: BOB,
        chain,
      });
      await publicClient.waitForTransactionReceipt({ hash });
      return (await publicClient.readContract({
        address: SIMPLE_TEST,
        abi: simpleTestAbi,
        functionName: 'getValueHash',
      })) as `0x${string}`;
    };
    // The snapshot covers an OLD value; the read below returns the current one.
    const oldHandle = await store(45n);
    await store(46n);

    const bobClient = createCofheClient(config);
    await bobClient.connect(publicClient, bobWallet);
    const snapshot = await bobClient.acp.createSharing({
      issuer: BOB.address,
      recipient: ALICE.address,
      name: 'old value only',
      handles: [oldHandle],
    });

    const aliceClient = createCofheClient(config);
    await aliceClient.connect(publicClient, aliceWallet);
    const narrow = await aliceClient.acp.importShared(bobClient.acp.export(snapshot), { activate: false });

    // Created a second later so it gets its own revoker id: revoking it must not touch the snapshot.
    await new Promise((resolve) => setTimeout(resolve, 1_100));
    const everything = await bobClient.acp.createSharing({
      issuer: BOB.address,
      recipient: ALICE.address,
      name: 'all',
    });
    const wide = await aliceClient.acp.importShared(bobClient.acp.export(everything), { activate: false });

    render(
      <CofheProvider
        cofheClient={aliceClient}
        queryClient={queryClient}
        publicClient={publicClient}
        walletClient={aliceWallet}
      >
        <CofheACPScope acp={narrow.hash}>
          <Decrypt label="narrow" />
        </CofheACPScope>
        <CofheACPScope acp={wide.hash}>
          <ScopeStatus label="wide status" />
          <Decrypt label="wide" />
        </CofheACPScope>
      </CofheProvider>
    );

    // The current value is not in the snapshot: flagged, and never sent for decryption.
    await waitFor(() => expect(shown('narrow')).toBe('out of scope'), { timeout: 90_000 });
    await waitFor(() => expect(shown('wide')).toBe('46'), { timeout: 90_000 });
    expect(shown('wide status')).toBe('valid');
    const narrowDecrypts = queryClient
      .getQueryCache()
      .findAll({ queryKey: ['decryptCiphertext'] })
      .filter((q) => q.queryKey[4] === narrow.hash && q.state.fetchStatus !== 'idle');
    expect(narrowDecrypts).toHaveLength(0);

    // Bob revokes the wide share. The next status check (here forced; otherwise on its interval or
    // window focus) turns the scope off and drops what it decrypted.
    const revokeTx = await bobClient.acp.revokeACP(everything);
    await publicClient.waitForTransactionReceipt({ hash: revokeTx });
    await queryClient.invalidateQueries({ queryKey: ['cofheACPStatus'] });

    await waitFor(() => expect(shown('wide status')).toBe('revoked'), { timeout: 30_000 });
    await waitFor(() => expect(shown('wide')).toBe('no valid acp'));
    expect(shown('wide value')).toBe('');
  }, 180_000);
});
