import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useInvalidationContextStore } from './invalidationContextStore';

/**
 * The watermark store's own rules — matching, expiry, pruning, precedence — on a fake clock.
 * Keys follow the cofhe read grammar `[prefix, chainId, address, functionName, args, acpHash]`
 * (args serialized, bigints as strings); watermarks are stored under the same kind of prefix an
 * invalidation target produces.
 */

const CHAIN = 421614;
const OTHER_CHAIN = 84532;
const OTC = '0x00000000000000000000000000000000000000A1';
const TOKEN = '0x00000000000000000000000000000000000000B2';

/** The key of one read: `functionName(...args)` on `address`. */
const readKey = (address: string, functionName: string, args: unknown[], chainId = CHAIN) => [
  'cofheReadContract',
  chainId,
  address,
  functionName,
  args,
  undefined,
];

const BLOCK_A = { blockHashToBeAwareOf: '0xaa' };
const BLOCK_B = { blockHashToBeAwareOf: '0xbb' };

const store = () => useInvalidationContextStore.getState();
const watermarkFor = (queryKey: readonly unknown[]) => store().findMatching(queryKey)?.context;

beforeEach(() => {
  vi.useFakeTimers({ now: 1_000_000 });
  useInvalidationContextStore.setState({ byKey: {} });
});

afterEach(() => {
  vi.useRealTimers();
});

describe('invalidation watermarks: matching (react-query partial-matching semantics)', () => {
  it('a contract-wide watermark covers every read of that contract — and nothing else', () => {
    store().set({ queryKey: ['cofheReadContract', CHAIN, OTC], context: BLOCK_A });

    expect(watermarkFor(readKey(OTC, 'getOrder', ['1']))).toEqual(BLOCK_A);
    expect(watermarkFor(readKey(OTC, 'getOrdersBatch', [['1', '2']]))).toEqual(BLOCK_A);
    expect(watermarkFor(readKey(TOKEN, 'balanceOf', [OTC]))).toBeUndefined();
    expect(watermarkFor(readKey(OTC, 'getOrder', ['1'], OTHER_CHAIN))).toBeUndefined();
  });

  it('an args-narrowed watermark covers the longer calls it prefixes: `args: [orderId]` reaches getPublish(orderId, seq)', () => {
    store().set({ queryKey: ['cofheReadContract', CHAIN, OTC, 'getPublish', ['7']], context: BLOCK_A });

    expect(watermarkFor(readKey(OTC, 'getPublish', ['7', '0']))).toEqual(BLOCK_A);
    expect(watermarkFor(readKey(OTC, 'getPublish', ['7', '12']))).toEqual(BLOCK_A);
    // Not another order, and not another function of the same contract.
    expect(watermarkFor(readKey(OTC, 'getPublish', ['8', '0']))).toBeUndefined();
    expect(watermarkFor(readKey(OTC, 'getOrder', ['7']))).toBeUndefined();
  });

  it('matches exactly what `invalidateQueries` matches — a trailing undefined segment equals a missing one', () => {
    // react-query compares segment by segment, and `undefined` equals a MISSING segment: this prefix
    // reaches the shorter key, and — like `invalidateQueries` — not a read whose segment 3 is a name.
    store().set({ queryKey: ['cofheReadContract', CHAIN, OTC, undefined], context: BLOCK_A });

    expect(watermarkFor(['cofheReadContract', CHAIN, OTC])).toEqual(BLOCK_A);
    expect(watermarkFor(readKey(OTC, 'getOrder', ['1']))).toBeUndefined();
  });
});

describe('invalidation watermarks: expiry', () => {
  it('covers its reads on EVERY lookup until ttlMs has passed — reading never consumes it', () => {
    store().set({ queryKey: ['cofheReadContract', CHAIN, OTC], context: BLOCK_A, ttlMs: 5_000 });
    const key = readKey(OTC, 'getOrder', ['1']);

    expect(watermarkFor(key)).toEqual(BLOCK_A);
    expect(watermarkFor(key)).toEqual(BLOCK_A);
    vi.advanceTimersByTime(4_999);
    expect(watermarkFor(key)).toEqual(BLOCK_A);
    vi.advanceTimersByTime(1);
    expect(watermarkFor(key)).toBeUndefined();
  });

  it('defaults to 60 seconds', () => {
    store().set({ queryKey: ['cofheReadContract', CHAIN, OTC], context: BLOCK_A });
    const key = readKey(OTC, 'getOrder', ['1']);

    vi.advanceTimersByTime(59_999);
    expect(watermarkFor(key)).toEqual(BLOCK_A);
    vi.advanceTimersByTime(1);
    expect(watermarkFor(key)).toBeUndefined();
  });

  it('setting a watermark prunes the expired ones, so they cannot pile up', () => {
    store().set({ queryKey: ['cofheReadContract', CHAIN, OTC], context: BLOCK_A, ttlMs: 1_000 });
    store().set({ queryKey: ['cofheReadContract', CHAIN, TOKEN], context: BLOCK_A, ttlMs: 10_000 });
    vi.advanceTimersByTime(1_000);

    // The expired OTC entry no longer matches, but stays stored until the next write…
    expect(Object.keys(store().byKey)).toHaveLength(2);

    store().set({ queryKey: ['cofheReadContract', OTHER_CHAIN, OTC], context: BLOCK_B });

    // …which drops it; the live TOKEN entry and the new one remain.
    expect(Object.values(store().byKey).map((entry) => entry.queryKey)).toStrictEqual([
      ['cofheReadContract', CHAIN, TOKEN],
      ['cofheReadContract', OTHER_CHAIN, OTC],
    ]);
  });
});

describe('invalidation watermarks: precedence', () => {
  it('the most recent matching watermark wins, however wide — back-to-back writes gate on the LATER block', () => {
    store().set({ queryKey: ['cofheReadContract', CHAIN, OTC, 'getOrder', ['1']], context: BLOCK_A });
    vi.advanceTimersByTime(1);
    store().set({ queryKey: ['cofheReadContract', CHAIN, OTC], context: BLOCK_B });

    expect(watermarkFor(readKey(OTC, 'getOrder', ['1']))).toEqual(BLOCK_B);
  });

  it('re-setting the same prefix replaces its entry — new block, fresh expiry', () => {
    const prefix = ['cofheReadContract', CHAIN, OTC];
    store().set({ queryKey: prefix, context: BLOCK_A, ttlMs: 1_000 });
    vi.advanceTimersByTime(900);
    store().set({ queryKey: prefix, context: BLOCK_B, ttlMs: 1_000 });

    expect(Object.keys(store().byKey)).toHaveLength(1);
    vi.advanceTimersByTime(900); // past the first entry's expiry, within the second's
    expect(watermarkFor(readKey(OTC, 'getOrder', ['1']))).toEqual(BLOCK_B);
  });
});
