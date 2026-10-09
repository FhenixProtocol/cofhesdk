/**
 * @vitest-environment happy-dom
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';

// Stub the on-chain EIP-712 domain read so the test needs no RPC (same approach as acps.test.ts).
vi.mock('../../acps/onchain-utils.js', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../acps/onchain-utils.js')>()),
  getAclEIP712Domain: async () => ({
    name: 'ACL',
    version: '2',
    chainId: 421614,
    verifyingContract: '0x1111111111111111111111111111111111111111' as `0x${string}`,
  }),
}));

import { custom, createWalletClient, type PublicClient, type WalletClient } from 'viem';
import { arbitrumSepolia } from 'viem/chains';
import { privateKeyToAccount } from 'viem/accounts';
import { acpStore } from '@/acps';
import { acps } from '../acps.js';

const chainId = 421614;
// Offline clients: the wallet signs typed data locally, and any RPC call fails the test.
const noRpc = custom({
  request: async ({ method }) => {
    throw new Error(`unexpected RPC call: ${method}`);
  },
});
const publicClient = { getChainId: async () => chainId } as unknown as PublicClient;
const walletClient: WalletClient = createWalletClient({
  chain: arbitrumSepolia,
  transport: noRpc,
  account: privateKeyToAccount('0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80'),
});
const checksummed = walletClient.account!.address; // 0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266
const lowercase = checksummed.toLowerCase();

describe('ACP store account keys are case-insensitive', () => {
  beforeEach(() => {
    acpStore.store.setState({ acps: {}, activeACPHash: {} });
  });

  it('finds the active ACP when the account is passed in lowercase', async () => {
    const created = await acps.createSelf({ issuer: checksummed }, publicClient, walletClient);

    expect(acps.getActiveACP(chainId, checksummed)?.hash).toBe(created.hash);
    expect(acps.getActiveACP(chainId, lowercase)?.hash).toBe(created.hash);
    expect(acps.getACP(chainId, lowercase, created.hash)?.hash).toBe(created.hash);
    expect(Object.keys(acps.getACPs(chainId, lowercase))).toEqual([created.hash]);
  });

  it('getOrCreateSelfACP with a lowercase account reuses the stored ACP instead of signing a new one', async () => {
    const signSpy = vi.spyOn(walletClient, 'signTypedData');

    const first = await acps.getOrCreateSelfACP(publicClient, walletClient, chainId, lowercase);
    const second = await acps.getOrCreateSelfACP(publicClient, walletClient, chainId, lowercase);

    expect(second.hash).toBe(first.hash);
    expect(signSpy).toHaveBeenCalledTimes(1);
    expect(Object.keys(acps.getACPs(chainId, checksummed))).toHaveLength(1);
  });

  it('keeps one bucket per account whatever case it is written and read in', async () => {
    const created = await acps.createSelf({ issuer: checksummed }, publicClient, walletClient);
    acpStore.store.setState({ acps: {}, activeACPHash: {} });

    // Stored under the lowercase spelling (e.g. a wallet client built from a lowercase address)...
    acpStore.setACP(chainId, lowercase, created);
    acpStore.setActiveACPHash(chainId, lowercase, created.hash);
    // ...still found with the checksummed one, and a write in that case reuses the same bucket.
    expect(acpStore.getActiveACP(chainId, checksummed)?.hash).toBe(created.hash);
    acpStore.setACP(chainId, checksummed, created);
    expect(Object.keys(acpStore.store.getState().acps[chainId])).toEqual([lowercase]);

    acpStore.removeACP(chainId, checksummed, created.hash);
    expect(acpStore.getActiveACPHash(chainId, lowercase)).toBeUndefined();
    expect(acpStore.getACP(chainId, lowercase, created.hash)).toBeUndefined();
  });
});
