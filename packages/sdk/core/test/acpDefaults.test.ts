import { describe, it, expect } from 'vitest';
import { acps } from '../acps.js';

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

const acpConfig = {
  defaultRevoker: { [CHAIN]: REVOKER },
  defaultContractScopes: { [CHAIN]: [CONTRACT_A] },
};

describe('applyACPDefaults', () => {
  it('injects default revoker (contract + creation timestamp) when no revoker options given', () => {
    const before = Math.round(Date.now() / 1000);
    const result = acps.applyACPDefaults(opts({}), acpConfig, CHAIN);
    expect(result.revokerContract).toBe(REVOKER);
    expect(result.revokerData).toBeGreaterThanOrEqual(before - 60); // 60s clock-skew backdating
    expect(result.revokerData).toBeLessThanOrEqual(Math.round(Date.now() / 1000) - 59);
  });

  it('does not override an explicit revoker pair', () => {
    const result = acps.applyACPDefaults({ revokerData: 42, revokerContract: CONTRACT_A }, acpConfig, CHAIN);
    expect(result.revokerData).toBe(42);
    expect(result.revokerContract).toBe(CONTRACT_A);
  });

  it('injects default contract scopes when no scope options given', () => {
    const result = acps.applyACPDefaults(opts({}), acpConfig, CHAIN);
    expect(result.contracts).toEqual([CONTRACT_A]);
  });

  it('does not inject scopes when the caller provides any scope option (incl. explicit scope)', () => {
    expect(acps.applyACPDefaults(opts({ scope: 0 }), acpConfig, CHAIN).contracts).toBeUndefined();
    expect(acps.applyACPDefaults(opts({ handles: [1n] }), acpConfig, CHAIN).contracts).toBeUndefined();
    expect(acps.applyACPDefaults(opts({ contracts: [] }), acpConfig, CHAIN).contracts).toEqual([]);
  });

  it('no-op for chains without defaults and for missing config', () => {
    expect(acps.applyACPDefaults(opts({}), acpConfig, 999)).toEqual({});
    expect(acps.applyACPDefaults(opts({}), undefined, CHAIN)).toEqual({});
  });
});
