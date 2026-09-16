/**
 * React hooks integration: a decrypt is cached PER CHAIN, on a real chain.
 *
 * `useCofheDecrypt` decrypts with the ACP and threshold network of the chain it is given
 * (`chainId`, default the connected chain), so the same ciphertext handle decrypted on two
 * chains is two different requests with two possibly different answers — and must be two cache
 * entries. One shared entry would let chain B render chain A's plaintext, and flipping `chainId`
 * on a mounted hook would never refetch.
 *
 * Chain B is played by a second client over the same Anvil under another chain id; one ACP is
 * registered under both chain slots so both reads and both decrypts are enabled.
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
import { CofheProvider, createCofheConfig, useCofheReadContractAndDecrypt } from '@cofhe/react';

const ANVIL_RPC = 'http://127.0.0.1:8546';
const CHAIN_A = 31337; // the connected chain (Anvil)
const CHAIN_B = 31338; // "another chain": same Anvil under a different id
// Anvil default account #7 — dedicated, so this file cannot race the other suites' nonces.
const ACCOUNT = privateKeyToAccount('0x4bbbf85ce3377467afe5d46f804f221813b2bb87f24d81f60f1fcdbf7cbf4356');

const chainA: Chain = defineChain({
  id: CHAIN_A,
  name: 'A',
  nativeCurrency: { name: 'Ether', symbol: 'ETH', decimals: 18 },
  rpcUrls: { default: { http: [ANVIL_RPC] } },
});
const chainB: Chain = defineChain({ ...chainA, id: CHAIN_B, name: 'B' });
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

function Decrypt({ label, chainId, publicClient }: { label: string; chainId: number; publicClient?: ReturnType<typeof createPublicClient> }) {
  const { decrypted } = useCofheReadContractAndDecrypt({
    address: SIMPLE_TEST,
    abi: simpleTestAbi,
    functionName: 'getValue',
    ...(publicClient ? { chainId, publicClient } : { chainId }),
  });
  return <output aria-label={label}>{decrypted.data === undefined ? '' : String(decrypted.data)}</output>;
}

const shown = (label: string) => screen.getByRole('status', { name: label }).textContent;

afterEach(() => acpStore.resetStore());

const describeOnAnvil = SIMPLE_TEST ? describe : describe.skip;

describeOnAnvil('react hooks: decrypt cache is per chain (Anvil)', () => {
  it('the same ctHash decrypted on two chains is two cache entries, each keyed by its chain', async () => {
    const publicClient = createPublicClient({ chain: chainA, transport: custom(transport()) });
    const walletClient = createWalletClient({ chain: chainA, transport: custom(transport()), account: ACCOUNT });
    const clientB = createPublicClient({ chain: chainB, transport: custom(transport()) });
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    const cofheClient = createCofheClient(
      createCofheConfig({ supportedChains: [hardhatCofheChain], react: { autogenerateACPs: false } })
    );

    // A nonzero encrypted value — a zero handle is a known zero, with nothing to decrypt.
    const hash = await walletClient.writeContract({
      address: SIMPLE_TEST,
      abi: simpleTestAbi,
      functionName: 'setValueTrivial',
      args: [42n],
      account: ACCOUNT,
      chain: chainA,
    });
    await publicClient.waitForTransactionReceipt({ hash });

    render(
      <CofheProvider cofheClient={cofheClient} queryClient={queryClient} publicClient={publicClient} walletClient={walletClient}>
        <Decrypt label="A" chainId={CHAIN_A} />
        <Decrypt label="B" chainId={CHAIN_B} publicClient={clientB} />
      </CofheProvider>
    );
    await waitFor(() => expect(cofheClient.connected).toBe(true), { timeout: 30_000 });
    const account = cofheClient.getSnapshot().account!;
    const acp = await cofheClient.acp.createSelf({ issuer: account, name: 'decrypt per chain' });
    for (const chainId of [CHAIN_A, CHAIN_B]) {
      acpStore.setACP(chainId, account, acp);
      acpStore.setActiveACPHash(chainId, account, acp.hash);
    }

    await waitFor(() => expect(shown('A')).toBe('42'), { timeout: 90_000 });
    await waitFor(() => expect(shown('B')).toBe('42'), { timeout: 90_000 });

    // Two chains, two entries, keyed `[prefix, chainId, ctHash, utype]` — the placeholder registered
    // before the reads resolved carries no ctHash.
    const decrypts = queryClient
      .getQueryCache()
      .findAll({ queryKey: ['decryptCiphertext'] })
      .filter((q) => q.queryKey[2] != null);
    expect(decrypts).toHaveLength(2);
    expect(decrypts.map((q) => q.queryKey[1]).sort()).toStrictEqual([CHAIN_A, CHAIN_B]);
  }, 180_000);
});
