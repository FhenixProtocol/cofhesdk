import { STAGING_TESTS, stagingViemChain } from '../../core/test/stagingRedirect';
import { arbSepolia as cofheArbSepolia, stagingCofhe } from '@/chains';
import { Encryptable } from '@/core';

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import type { PublicClient, WalletClient } from 'viem';
import { createPublicClient, createWalletClient, http } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { arbitrumSepolia as viemArbitrumSepolia } from 'viem/chains';
import { createCofheClient, createCofheConfig, terminateWorker, getTfheThreadPoolStatus } from '../index';
import { THREADPOOL_TESTS } from './threadPoolBenchHelper';

// Which thread needs a rayon pool?
//
// With workers on (the default) the ZK proof is generated inside the zkProve
// worker, which runs its own tfhe and its own rayon pool. The main thread does
// not touch tfhe at all, so a pool there is pure overhead: N idle Web Workers plus a
// second shared wasm memory. The main thread should start one only when it has
// to generate a proof itself.
//
// Rayon threads started by the main thread are `new Worker(...)` calls made by
// the page. The ones the zkProve worker starts are made inside that worker and
// never reach the page's `Worker` constructor. Counting page-level helper
// workers therefore measures the main-thread pool and nothing else.
//
// Own file on purpose: every vitest browser file gets a fresh tfhe wasm
// instance, and a rayon pool can only be started once per instance. The tests
// below share that instance and depend on their order.

const TEST_PRIVATE_KEY = '0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80';
const THREADS = 2;

const testViemChain = STAGING_TESTS ? stagingViemChain : viemArbitrumSepolia;
const testCofheChain = STAGING_TESTS ? stagingCofhe : cofheArbSepolia;

describe.skipIf(!THREADPOOL_TESTS)('@cofhe/sdk/web - main-thread rayon pool', () => {
  const RealWorker = globalThis.Worker;
  let rayonWorkersStartedByPage = 0;
  let publicClient: PublicClient;
  let walletClient: WalletClient;
  let consumingContract: `0x${string}`;
  let proveContext: any;

  beforeAll(async () => {
    (globalThis as any).Worker = class extends RealWorker {
      constructor(url: string | URL, options?: WorkerOptions) {
        super(url, options);
        if (String(url).includes('workerHelpers')) rayonWorkersStartedByPage++;
      }
    };

    publicClient = createPublicClient({ chain: testViemChain, transport: http() });
    const account = privateKeyToAccount(TEST_PRIVATE_KEY);
    walletClient = createWalletClient({ chain: testViemChain, transport: http(), account });
    consumingContract = account.address;

    const config = createCofheConfig({ supportedChains: [testCofheChain], tfheThreads: THREADS });
    const client = createCofheClient(config);
    await client.connect(publicClient, walletClient);

    await client
      .encryptInputs([Encryptable.uint32(7n)])
      .setConsumingContract(consumingContract)
      .onStep((step, context) => {
        if (step === 'prove' && context?.isEnd) proveContext = context;
      })
      .execute();
  }, 240000);

  afterAll(() => {
    (globalThis as any).Worker = RealWorker;
    terminateWorker();
  });

  it('generates the proof in the worker', () => {
    expect(globalThis.crossOriginIsolated).toBe(true);
    expect(proveContext?.usedWorker).toBe(true);
    expect(proveContext?.workerFailedError).toBeUndefined();
  });

  it('does not start a rayon pool on the main thread when the worker proves', () => {
    expect(rayonWorkersStartedByPage).toBe(0);
    expect(getTfheThreadPoolStatus()).toBeNull();
  });

  // Runs after a worker-path encryption: the main thread has not used tfhe yet,
  // and the pool must come up when it first has to prove.
  it('starts the pool once the main thread has to prove', async () => {
    const config = createCofheConfig({
      supportedChains: [testCofheChain],
      tfheThreads: THREADS,
      useWorkers: false,
    });
    const client = createCofheClient(config);
    await client.connect(publicClient, walletClient);

    let mainThreadProveContext: any;
    await client
      .encryptInputs([Encryptable.uint32(8n)])
      .setConsumingContract(consumingContract)
      .onStep((step, context) => {
        if (step === 'prove' && context?.isEnd) mainThreadProveContext = context;
      })
      .execute();

    expect(mainThreadProveContext?.usedWorker).toBe(false);
    expect(rayonWorkersStartedByPage).toBe(THREADS);
    expect(getTfheThreadPoolStatus()).toEqual({ enabled: true, threads: THREADS });
  }, 240000);
});
