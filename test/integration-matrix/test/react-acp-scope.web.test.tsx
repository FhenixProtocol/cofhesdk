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
  CofheProvider,
  createCofheConfig,
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
  const { decrypted, isDecryptError, disabledDueToMissingValidACP } = useCofheReadContractAndDecrypt({
    address: SIMPLE_TEST,
    abi: simpleTestAbi,
    functionName: 'getValue',
    acp,
  });
  const text = disabledDueToMissingValidACP
    ? 'no valid acp'
    : isDecryptError
      ? 'decrypt error'
      : decrypted.data === undefined
        ? ''
        : String(decrypted.data);
  return <output aria-label={label}>{text}</output>;
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
        <CofheACPScope acp={{ ...shared, expiration: 1 }}>
          <Decrypt label="expired" />
        </CofheACPScope>
      </CofheProvider>
    );

    await waitFor(() => expect(shown('scoped')).toBe('42'), { timeout: 90_000 });
    await waitFor(() => expect(shown('own')).toBe('decrypt error'), { timeout: 90_000 });
    await waitFor(() => expect(shown('override')).toBe('decrypt error'), { timeout: 90_000 });
    expect(shown('expired')).toBe('no valid acp');
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
});
