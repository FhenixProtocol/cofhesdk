import { describe, expect, it } from 'vitest';
import { blockAwareWatermarkKey, normalizeInvalidationTarget } from './useCofheWriteContract';

/**
 * The write hook's invalidation rule, on plain data: dirty every declared target, gate only the
 * ones on the chain where the mined block exists. `normalizeInvalidationTarget` works out which
 * chain a target belongs to; `blockAwareWatermarkKey` decides whether — and under which prefix —
 * the mined block becomes its watermark.
 */

const MINED = 31337;
const OTHER = 31338;
const ADDR = '0x00000000000000000000000000000000000000A1';
const PREFIX = 'cofheReadContract';

describe('normalizeInvalidationTarget: the chain a target belongs to', () => {
  it('descriptor: its own chainId, else the connected chain, else unknown', () => {
    expect(normalizeInvalidationTarget({ address: ADDR, chainId: OTHER }, MINED).targetChainId).toBe(OTHER);
    expect(normalizeInvalidationTarget({ address: ADDR }, MINED).targetChainId).toBe(MINED);
    expect(normalizeInvalidationTarget({ address: ADDR }, undefined).targetChainId).toBeUndefined();
  });

  it('raw cofhe key: its chain segment when it has one, else unknown', () => {
    expect(normalizeInvalidationTarget([PREFIX, OTHER, ADDR], MINED).targetChainId).toBe(OTHER);
    expect(normalizeInvalidationTarget([PREFIX], MINED).targetChainId).toBeUndefined();
    expect(normalizeInvalidationTarget(['readContract', { chainId: OTHER }], MINED).targetChainId).toBeUndefined();
  });

  it('filters: the given targetChainId, else parsed from a cofhe key, else unknown', () => {
    expect(
      normalizeInvalidationTarget({ queryKey: ['readContract', { chainId: OTHER }], targetChainId: OTHER }, MINED)
        .targetChainId
    ).toBe(OTHER);
    expect(normalizeInvalidationTarget({ queryKey: [PREFIX, OTHER, ADDR], exact: false }, MINED).targetChainId).toBe(
      OTHER
    );
    expect(normalizeInvalidationTarget({ queryKey: ['readContract'] }, MINED).targetChainId).toBeUndefined();
  });
});

describe('blockAwareWatermarkKey: gate only on the chain where the block exists', () => {
  it('a target on the mined chain gates its whole key', () => {
    const key = [PREFIX, MINED, ADDR, 'getItem'];
    expect(blockAwareWatermarkKey({ queryKey: key, targetChainId: MINED }, MINED)).toBe(key);
  });

  it('a target on another chain gets a plain refresh', () => {
    expect(blockAwareWatermarkKey({ queryKey: [PREFIX, OTHER, ADDR], targetChainId: OTHER }, MINED)).toBeUndefined();
  });

  it('a target of unknown chain gets a plain refresh — never a watermark for a block its node may not see', () => {
    expect(blockAwareWatermarkKey({ queryKey: ['readContract', { chainId: OTHER }] }, MINED)).toBeUndefined();
  });

  it('when the mined chain itself is unknown nothing is gated', () => {
    expect(blockAwareWatermarkKey({ queryKey: [PREFIX, MINED, ADDR], targetChainId: MINED }, undefined)).toBeUndefined();
    expect(blockAwareWatermarkKey({ queryKey: [PREFIX] }, undefined)).toBeUndefined();
  });

  it('a cofhe prefix spanning every chain gates the mined chain’s slice only', () => {
    expect(blockAwareWatermarkKey({ queryKey: [PREFIX] }, MINED)).toStrictEqual([PREFIX, MINED]);
    expect(blockAwareWatermarkKey({ queryKey: [PREFIX, undefined, ADDR, 'getItem'] }, MINED)).toStrictEqual([
      PREFIX,
      MINED,
      ADDR,
      'getItem',
    ]);
  });
});
