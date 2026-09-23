import { describe, it, expect } from 'vitest';
import { FHE_GAS_LIMITS, getRecommendedFheGasLimit } from '../index.js';

describe('FHE Gas Limits & Helpers', () => {
  it('exposes defined gas limits for all FHE operation categories', () => {
    expect(FHE_GAS_LIMITS.COMPUTE).toBe(5_000_000n);
    expect(FHE_GAS_LIMITS.PUBLISH_RESULT).toBe(500_000n);
    expect(FHE_GAS_LIMITS.VERIFY_INPUT).toBe(1_000_000n);
  });

  it('getRecommendedFheGasLimit returns correct gas limit per operation', () => {
    expect(getRecommendedFheGasLimit('COMPUTE')).toBe(5_000_000n);
    expect(getRecommendedFheGasLimit('PUBLISH_RESULT')).toBe(500_000n);
    expect(getRecommendedFheGasLimit('VERIFY_INPUT')).toBe(1_000_000n);
  });

  it('getRecommendedFheGasLimit defaults to COMPUTE limit when omitted', () => {
    expect(getRecommendedFheGasLimit()).toBe(5_000_000n);
  });
});
