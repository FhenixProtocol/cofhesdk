/**
 * @vitest-environment happy-dom
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

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

vi.mock('../keyStore', () => ({
  createKeysStore: vi.fn(() => ({
    rehydrateKeysStore: vi.fn().mockResolvedValue(undefined),
    getFheKey: vi.fn(),
    getCrs: vi.fn(),
    setFheKey: vi.fn(),
    setCrs: vi.fn(),
    clearKeysStorage: vi.fn(),
    store: {} as any,
  })),
}));

import { custom, createWalletClient, type PublicClient } from 'viem';
import { arbitrumSepolia } from 'viem/chains';
import { privateKeyToAccount } from 'viem/accounts';
import { acpStore } from '@/acps';
import { createCofheClientBase } from '../client';
import { type CofheClient } from '../clientTypes';
import { createCofheConfigBase } from '../config';

const CHAIN_ID = 421614;
const REVOKER = '0x00000000000000000000000000000000000000aa';
const RECIPIENT = '0x00000000000000000000000000000000000000a1';
const SEVEN_DAYS = 7 * 24 * 60 * 60;
// A chain clock 30 days ahead of the local one, as in a Hardhat test after `time.increase`.
const BLOCK_TIMESTAMP = Math.round(Date.now() / 1000) + 30 * 24 * 60 * 60;

// Offline clients: the wallet signs typed data locally, and any RPC call fails the test.
const walletClient = createWalletClient({
  chain: arbitrumSepolia,
  transport: custom({
    request: async ({ method }) => {
      throw new Error(`unexpected RPC call: ${method}`);
    },
  }),
  account: privateKeyToAccount('0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80'),
});
const ACCOUNT = walletClient.account.address;
const getBlock = vi.fn();
const publicClient = {
  getChainId: vi.fn().mockResolvedValue(CHAIN_ID),
  getBlock,
} as unknown as PublicClient;

const connectedClient = async (defaultACPExpiration?: number): Promise<CofheClient> => {
  const client = createCofheClientBase({
    config: createCofheConfigBase({
      supportedChains: [],
      defaultACPExpiration,
      acp: { defaultRevoker: { [CHAIN_ID]: REVOKER } },
    }),
    zkBuilderAndCrsGenerator: {} as any,
    tfhePublicKeyDeserializer: {} as any,
    compactPkeCrsDeserializer: {} as any,
    initTfhe: () => Promise.resolve(false),
  });
  await client.connect(publicClient, walletClient);
  return client;
};

describe('acps the client creates expire defaultACPExpiration seconds after the latest block', () => {
  beforeEach(() => {
    acpStore.store.setState({ acps: {}, activeACPHash: {} });
    getBlock.mockResolvedValue({ timestamp: BigInt(BLOCK_TIMESTAMP) });
  });

  it('applies to self acps', async () => {
    const client = await connectedClient(3600);

    expect((await client.acp.createSelf({ issuer: ACCOUNT })).expiration).toBe(BLOCK_TIMESTAMP + 3600);
    acpStore.store.setState({ acps: {}, activeACPHash: {} });
    expect((await client.acp.getOrCreateSelfACP()).expiration).toBe(BLOCK_TIMESTAMP + 3600);
  });

  it('applies to sharing acps', async () => {
    const client = await connectedClient(3600);
    const options = { issuer: ACCOUNT, recipient: RECIPIENT };

    expect((await client.acp.createSharing(options)).expiration).toBe(BLOCK_TIMESTAMP + 3600);
    expect((await client.acp.getOrCreateSharingACP(options)).expiration).toBe(BLOCK_TIMESTAMP + 3600);
  });

  it('defaults to 7 days, so a chain clock ahead of the local one does not expire a new acp', async () => {
    const client = await connectedClient();

    const acp = await client.acp.createSelf({ issuer: ACCOUNT });

    expect(acp.expiration).toBe(BLOCK_TIMESTAMP + SEVEN_DAYS);
  });

  it('leaves an explicit expiration as given', async () => {
    const client = await connectedClient(3600);

    const acp = await client.acp.createSelf({ issuer: ACCOUNT, expiration: BLOCK_TIMESTAMP + 60 });

    expect(acp.expiration).toBe(BLOCK_TIMESTAMP + 60);
  });
});

describe('get-or-create checks the stored acp against the latest block', () => {
  beforeEach(() => {
    acpStore.store.setState({ acps: {}, activeACPHash: {} });
    getBlock.mockResolvedValue({ timestamp: BigInt(BLOCK_TIMESTAMP) });
  });

  it('creates a new self acp once the chain is past the active one', async () => {
    const client = await connectedClient(3600);
    const first = await client.acp.getOrCreateSelfACP();
    expect((await client.acp.getOrCreateSelfACP()).hash).toBe(first.hash);

    // `time.increase(7200)`: the local clock is still well before the acp's expiration.
    getBlock.mockResolvedValue({ timestamp: BigInt(BLOCK_TIMESTAMP + 7200) });
    const second = await client.acp.getOrCreateSelfACP();

    expect(second.hash).not.toBe(first.hash);
    expect(second.expiration).toBe(BLOCK_TIMESTAMP + 7200 + 3600);
  });

  it('creates a new sharing acp once the chain is past the active one', async () => {
    const client = await connectedClient(3600);
    const options = { issuer: ACCOUNT, recipient: RECIPIENT };
    const first = await client.acp.getOrCreateSharingACP(options);
    client.acp.selectActiveACP(first.hash);
    expect((await client.acp.getOrCreateSharingACP(options)).hash).toBe(first.hash);

    getBlock.mockResolvedValue({ timestamp: BigInt(BLOCK_TIMESTAMP + 7200) });
    const second = await client.acp.getOrCreateSharingACP(options);

    expect(second.hash).not.toBe(first.hash);
    expect(second.expiration).toBe(BLOCK_TIMESTAMP + 7200 + 3600);
  });
});
