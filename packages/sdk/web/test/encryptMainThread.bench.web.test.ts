/**
 * Benchmark: how long `encryptInputs().execute()` keeps the main thread busy on the worker path.
 *
 * A proof made in the Web Worker should leave the page responsive. This measures whether it
 * does: a timer ticks as fast as the event loop lets it, and a gap between two ticks is time
 * the main thread could not paint or answer input. Skipped by default (it makes real proofs
 * and calls the testnet verifier); run it on its own:
 *
 *   TEST_ENCRYPT_BENCH_ENABLED=true pnpm vitest run web/test/encryptMainThread.bench.web.test.ts
 */
import { STAGING_TESTS, stagingViemChain } from '../../core/test/stagingRedirect';
import { arbSepolia as cofheArbSepolia, stagingCofhe } from '@/chains';
import { Encryptable, EncryptStep } from '@/core';

import { describe, it, expect } from 'vitest';
import { createPublicClient, createWalletClient, http } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { arbitrumSepolia as viemArbitrumSepolia } from 'viem/chains';
import { createCofheClient, createCofheConfig } from '../index.js';

// Injected by vitest.config.mts from TEST_ENCRYPT_BENCH_ENABLED.
declare const __ENCRYPT_BENCH__: boolean | undefined;
const ENCRYPT_BENCH = typeof __ENCRYPT_BENCH__ !== 'undefined' ? __ENCRYPT_BENCH__ : false;

// Anvil's well-known account #0: it only signs, and needs no funds.
const TEST_PRIVATE_KEY = '0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80';
const testViemChain = STAGING_TESTS ? stagingViemChain : viemArbitrumSepolia;
const testCofheChain = STAGING_TESTS ? stagingCofhe : cofheArbSepolia;

const WARM_CALLS = 6;
/** A gap this long is a "long task": the page visibly stutters. */
const LONG_GAP_MS = 50;

type Tick = { at: number; gap: number };

/** Ticks as often as the event loop allows and records how late each tick was. */
function startTicker() {
  const ticks: Tick[] = [];
  let last = performance.now();
  let running = true;
  const tick = () => {
    if (!running) return;
    const now = performance.now();
    ticks.push({ at: now, gap: now - last });
    last = now;
    setTimeout(tick, 0);
  };
  setTimeout(tick, 0);
  return {
    stop: () => {
      running = false;
      return ticks;
    },
  };
}

/** The gaps that ended inside [from, to]: the longest one, and the total of the long ones. */
function blocking(ticks: Tick[], from: number, to: number) {
  const gaps = ticks.filter((t) => t.at >= from && t.at - t.gap <= to).map((t) => t.gap);
  return {
    maxGapMs: Math.round(Math.max(0, ...gaps)),
    longGapsMs: Math.round(gaps.filter((gap) => gap > LONG_GAP_MS).reduce((sum, gap) => sum + gap, 0)),
  };
}

const median = (values: number[]) => [...values].sort((a, b) => a - b)[Math.floor(values.length / 2)];

describe.skipIf(!ENCRYPT_BENCH)('encryptInputs: main-thread blocking on the worker path', () => {
  it('measures one cold and several warm encrypts', async () => {
    const account = privateKeyToAccount(TEST_PRIVATE_KEY);
    const publicClient = createPublicClient({ chain: testViemChain, transport: http() });
    const walletClient = createWalletClient({ chain: testViemChain, transport: http(), account });

    const client = createCofheClient(createCofheConfig({ supportedChains: [testCofheChain], useWorkers: true }));
    await client.connect(publicClient, walletClient);

    const runOnce = async (index: number) => {
      const stepStart: Partial<Record<EncryptStep, number>> = {};
      const stepMs: Partial<Record<EncryptStep, number>> = {};
      let usedWorker: boolean | undefined;
      let workerFailedError: string | undefined;

      const ticker = startTicker();
      // Let the ticker settle so the first gap is not the test's own setup.
      await new Promise((resolve) => setTimeout(resolve, 50));

      const started = performance.now();
      await client
        .encryptInputs([Encryptable.uint128(BigInt(1000 + index))])
        .setConsumingContract(account.address)
        .onStep((step, context) => {
          const now = performance.now();
          if (context?.isStart) stepStart[step] = now;
          if (context?.isEnd) {
            stepMs[step] = Math.round(now - (stepStart[step] ?? now));
            if (step === EncryptStep.Prove) {
              usedWorker = context.usedWorker;
              workerFailedError = context.workerFailedError;
            }
          }
        })
        .execute();
      const ended = performance.now();
      const ticks = ticker.stop();

      const proveStart = stepStart[EncryptStep.Prove] ?? ended;
      return {
        usedWorker,
        workerFailedError,
        totalMs: Math.round(ended - started),
        steps: stepMs,
        // Everything before the worker is asked to prove: the part that should be near zero.
        beforeProve: blocking(ticks, started, proveStart),
        whole: blocking(ticks, started, ended),
      };
    };

    const cold = await runOnce(0);
    const warm = [];
    for (let i = 1; i <= WARM_CALLS; i++) {
      // Spaced out: each call asks the testnet verifier to check one proof.
      await new Promise((resolve) => setTimeout(resolve, 500));
      warm.push(await runOnce(i));
    }

    const warmMedian = {
      totalMs: median(warm.map((run) => run.totalMs)),
      fetchKeysMs: median(warm.map((run) => run.steps[EncryptStep.FetchKeys] ?? 0)),
      packMs: median(warm.map((run) => run.steps[EncryptStep.Pack] ?? 0)),
      proveMs: median(warm.map((run) => run.steps[EncryptStep.Prove] ?? 0)),
      verifyMs: median(warm.map((run) => run.steps[EncryptStep.Verify] ?? 0)),
      beforeProveMaxGapMs: median(warm.map((run) => run.beforeProve.maxGapMs)),
      beforeProveLongGapsMs: median(warm.map((run) => run.beforeProve.longGapsMs)),
      wholeMaxGapMs: median(warm.map((run) => run.whole.maxGapMs)),
      wholeLongGapsMs: median(warm.map((run) => run.whole.longGapsMs)),
    };

    console.log(`[ENCRYPT BENCH] ${JSON.stringify({ cold, warmMedian, warm }, null, 2)}`);

    expect(cold.usedWorker).toBe(true);
    expect(warm.every((run) => run.usedWorker)).toBe(true);
  }, 300000);
});
