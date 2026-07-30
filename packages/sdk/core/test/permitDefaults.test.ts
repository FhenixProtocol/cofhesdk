import { describe, it, expect } from 'vitest';
import { permits } from '../permits.js';

type ScopeOpts = {
  revokerData?: number;
  revokerContract?: string;
  scope?: number;
  contracts?: string[];
  handles?: bigint[];
};
const opts = (o: ScopeOpts): ScopeOpts => o;

const CHAIN = 31337;
const REVOKER = '0x00000000000000000000000000000000000000aa' as `0x${string}`;
const CONTRACT_A = '0x00000000000000000000000000000000000000bb' as `0x${string}`;

const permitConfig = {
  defaultRevoker: { [CHAIN]: REVOKER },
  defaultContractScopes: { [CHAIN]: [CONTRACT_A] },
};

describe('applyPermitDefaults', () => {
  it('injects default revoker (contract + creation timestamp) when no revoker options given', () => {
    const before = Math.round(Date.now() / 1000);
    const result = permits.applyPermitDefaults(opts({}), permitConfig, CHAIN);
    expect(result.revokerContract).toBe(REVOKER);
    expect(result.revokerData).toBeGreaterThanOrEqual(before - 60); // 60s clock-skew backdating
    expect(result.revokerData).toBeLessThanOrEqual(Math.round(Date.now() / 1000) - 59);
  });

  it('does not override an explicit revoker pair', () => {
    const result = permits.applyPermitDefaults({ revokerData: 42, revokerContract: CONTRACT_A }, permitConfig, CHAIN);
    expect(result.revokerData).toBe(42);
    expect(result.revokerContract).toBe(CONTRACT_A);
  });

  it('injects default contract scopes when no scope options given', () => {
    const result = permits.applyPermitDefaults(opts({}), permitConfig, CHAIN);
    expect(result.contracts).toEqual([CONTRACT_A]);
  });

  it('does not inject scopes when the caller provides any scope option (incl. explicit scope)', () => {
    expect(permits.applyPermitDefaults(opts({ scope: 0 }), permitConfig, CHAIN).contracts).toBeUndefined();
    expect(permits.applyPermitDefaults(opts({ handles: [1n] }), permitConfig, CHAIN).contracts).toBeUndefined();
    expect(permits.applyPermitDefaults(opts({ contracts: [] }), permitConfig, CHAIN).contracts).toEqual([]);
  });

  it('no-op for chains without defaults and for missing config', () => {
    expect(permits.applyPermitDefaults(opts({}), permitConfig, 999)).toEqual({});
    expect(permits.applyPermitDefaults(opts({}), undefined, CHAIN)).toEqual({});
  });
});
