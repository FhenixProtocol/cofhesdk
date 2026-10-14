import { describe, it, expect, vi, afterEach } from 'vitest';
import { type PublicClient, type WalletClient } from 'viem';
import { createCofheClientBase } from '../client';
import { type CofheClient } from '../clientTypes';
import { createCofheConfigBase, type CofheInputConfig } from '../config';
import { acps } from '../acps';
import { shareAppKey } from '../../acps/share-metadata';

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

const CHAIN_ID = 11155111;
const ACCOUNT = '0x1234567890123456789012345678901234567890';
const REGISTRY = '0x00000000000000000000000000000000000000e0';
const APP = 'explorer.fhenix.io';
const APP_KEY = shareAppKey(APP);

const publicClient = { getChainId: vi.fn().mockResolvedValue(CHAIN_ID) } as unknown as PublicClient;
const walletClient = {
  getAddresses: vi.fn().mockResolvedValue([ACCOUNT]),
  account: { address: ACCOUNT },
} as unknown as WalletClient;

/** A connected client; `acp.sharingRegistry` is set so the on-chain calls need no ACL lookup. */
const connectedClient = async (acp: CofheInputConfig['acp']): Promise<CofheClient> => {
  const client = createCofheClientBase({
    config: createCofheConfigBase({ supportedChains: [], acp: { sharingRegistry: { [CHAIN_ID]: REGISTRY }, ...acp } }),
    zkBuilderAndCrsGenerator: {} as any,
    tfhePublicKeyDeserializer: {} as any,
    compactPkeCrsDeserializer: {} as any,
    initTfhe: () => Promise.resolve(false),
  });
  await client.connect(publicClient, walletClient);
  return client;
};

const sharingOptions = { issuer: ACCOUNT, recipient: '0x00000000000000000000000000000000000000a1' };

describe('the app key from config.acp.app', () => {
  const spies = {
    defaults: vi.spyOn(acps, 'applyACPDefaultsFromChain').mockImplementation(async (options) => options),
    createSharing: vi.spyOn(acps, 'createSharing').mockResolvedValue({} as any),
    getOrCreate: vi.spyOn(acps, 'getOrCreateSharingACP').mockResolvedValue({} as any),
    shareOnChain: vi.spyOn(acps, 'shareOnChain').mockResolvedValue({ txHash: '0x', shareId: '0x' }),
    getIncoming: vi.spyOn(acps, 'getIncomingShares').mockResolvedValue([]),
  };
  afterEach(() => Object.values(spies).forEach((spy) => spy.mockClear()));

  it('goes on every share the client creates', async () => {
    const client = await connectedClient({ app: APP });
    await client.acp.createSharing(sharingOptions);
    expect(spies.createSharing.mock.calls[0][0]).toMatchObject({ ...sharingOptions, appKey: APP_KEY });

    await client.acp.getOrCreateSharingACP(sharingOptions);
    expect(spies.getOrCreate.mock.calls[0][2]).toMatchObject({ ...sharingOptions, appKey: APP_KEY });
  });

  it('goes with labels posted by shareOnChain', async () => {
    const client = await connectedClient({ app: APP });
    await client.acp.shareOnChain({} as any, { labels: [] });
    expect(spies.shareOnChain.mock.calls[0][3]).toEqual({ labels: [], appKey: APP_KEY });
  });

  it('filters the inbox', async () => {
    const client = await connectedClient({ app: APP });
    await client.acp.getIncomingShares();
    expect(spies.getIncoming).toHaveBeenCalledWith(publicClient, REGISTRY, ACCOUNT, { appKey: APP_KEY });
  });

  it('is the keccak256 of the app name, and an explicit appKey wins over it', async () => {
    const client = await connectedClient({ app: APP });
    const other = shareAppKey('other.app');
    await client.acp.createSharing({ ...sharingOptions, appKey: other });
    expect(spies.createSharing.mock.calls[0][0]).toMatchObject({ appKey: other });
    expect(APP_KEY).toMatch(/^0x[0-9a-f]{64}$/);
  });

  it('is absent without an app: shares carry no key and every share is listed', async () => {
    const client = await connectedClient({});
    await client.acp.createSharing(sharingOptions);
    expect(spies.createSharing.mock.calls[0][0]).not.toHaveProperty('appKey');
    await client.acp.getIncomingShares();
    expect(spies.getIncoming).toHaveBeenCalledWith(publicClient, REGISTRY, ACCOUNT, {});
  });
});
