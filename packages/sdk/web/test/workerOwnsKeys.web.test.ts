import { STAGING_TESTS, stagingViemChain } from '../../core/test/stagingRedirect';
import { arbSepolia as cofheArbSepolia, stagingCofhe } from '@/chains';
import { Encryptable, EncryptStep, type IStorage } from '@/core';

import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import type { PublicClient, WalletClient } from 'viem';
import { createPublicClient, createWalletClient, http } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { arbitrumSepolia as viemArbitrumSepolia } from 'viem/chains';
import { createCofheClient, createCofheConfig, terminateWorker } from '../index.js';

// With workers on, the proving worker gets the keys by itself and keeps them in its own
// IndexedDB database. The page never holds them. If the page has to prove after all, it takes
// the keys from the worker's store instead of downloading them a second time.
//
// The tests share the worker's store and depend on their order.

const TEST_PRIVATE_KEY = '0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80';
const testViemChain = STAGING_TESTS ? stagingViemChain : viemArbitrumSepolia;
const testCofheChain = STAGING_TESTS ? stagingCofhe : cofheArbSepolia;

/** A page-side key storage that only lives in memory, and records what is written to it. */
function recordingStorage() {
  const items = new Map<string, unknown>();
  const storage: IStorage = {
    getItem: async (name) => items.get(name) ?? null,
    setItem: vi.fn(async (name, value) => void items.set(name, value)),
    removeItem: async (name) => void items.delete(name),
  };
  return storage as IStorage & { setItem: ReturnType<typeof vi.fn> };
}

const isKeyDownload = (input: unknown) =>
  /GetNetworkPublicKey|GetCrs/.test(String((input as { url?: string })?.url ?? input));

describe('@cofhe/sdk/web - the proving worker owns the keys', () => {
  let publicClient: PublicClient;
  let walletClient: WalletClient;
  let consumingContract: `0x${string}`;

  beforeAll(() => {
    const account = privateKeyToAccount(TEST_PRIVATE_KEY);
    publicClient = createPublicClient({ chain: testViemChain, transport: http() });
    walletClient = createWalletClient({ chain: testViemChain, transport: http(), account });
    consumingContract = account.address;
  });

  afterAll(() => terminateWorker());

  const encrypt = async (client: ReturnType<typeof createCofheClient>) => {
    const ended: Record<string, any> = {};
    const result = await client
      .encryptInputs([Encryptable.uint64(11n)])
      .setConsumingContract(consumingContract)
      .onStep((step, context) => {
        if (context?.isEnd) ended[step] = context;
      })
      .execute();
    return { result, ended };
  };

  it('keeps the keys off the page when the worker proves', async () => {
    const pageStorage = recordingStorage();
    const pageFetch = vi.spyOn(globalThis, 'fetch');

    const client = createCofheClient(
      createCofheConfig({ supportedChains: [testCofheChain], fheKeyStorage: pageStorage })
    );
    await client.connect(publicClient, walletClient);
    const { result, ended } = await encrypt(client);

    expect(result.length).toBe(2);
    expect(ended[EncryptStep.Prove]).toMatchObject({ usedWorker: true, workerFailedError: undefined });
    expect(ended[EncryptStep.Pack]).toMatchObject({ packedInWorker: true });

    // Neither downloaded by the page nor stored by it: the worker did both.
    expect(pageFetch.mock.calls.filter(([input]) => isKeyDownload(input))).toEqual([]);
    expect(pageStorage.setItem).not.toHaveBeenCalled();
    pageFetch.mockRestore();
  }, 120000);

  it('does not download or load the keys again for the next encrypt', async () => {
    const client = createCofheClient(
      createCofheConfig({ supportedChains: [testCofheChain], fheKeyStorage: recordingStorage() })
    );
    await client.connect(publicClient, walletClient);
    const { ended } = await encrypt(client);

    expect(ended[EncryptStep.InitTfhe]).toMatchObject({ tfheInitializationExecuted: false });
    expect(ended[EncryptStep.FetchKeys]).toMatchObject({ fheKeyFetchedFromCoFHE: false, crsFetchedFromCoFHE: false });
    expect(ended[EncryptStep.Prove]).toMatchObject({ usedWorker: true });
  }, 120000);

  it('gives the main thread the keys the worker stored when it has to prove', async () => {
    // A page that holds no keys of its own, proving on the main thread.
    const pageStorage = recordingStorage();
    const pageFetch = vi.spyOn(globalThis, 'fetch');

    const client = createCofheClient(
      createCofheConfig({ supportedChains: [testCofheChain], fheKeyStorage: pageStorage, useWorkers: false })
    );
    await client.connect(publicClient, walletClient);
    const { result, ended } = await encrypt(client);

    expect(result.length).toBe(2);
    expect(ended[EncryptStep.Prove]).toMatchObject({ usedWorker: false });
    expect(ended[EncryptStep.FetchKeys]).toMatchObject({ fheKeyFetchedFromCoFHE: false, crsFetchedFromCoFHE: false });
    expect(pageFetch.mock.calls.filter(([input]) => isKeyDownload(input))).toEqual([]);
    pageFetch.mockRestore();
  }, 120000);
});
