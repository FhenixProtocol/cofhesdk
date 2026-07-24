import { describe, it, expect } from 'vitest';
import { permits } from '../permits.js';

type ScopeOpts = {
  validatorId?: number;
  validatorContract?: string;
  global?: boolean;
  contracts?: string[];
  handles?: bigint[];
};
const opts = (o: ScopeOpts): ScopeOpts => o;

const CHAIN = 31337;
const VALIDATOR = '0x00000000000000000000000000000000000000aa' as `0x${string}`;
const CONTRACT_A = '0x00000000000000000000000000000000000000bb' as `0x${string}`;

const permitConfig = {
  defaultValidator: { [CHAIN]: VALIDATOR },
  defaultContractScopes: { [CHAIN]: [CONTRACT_A] },
};

describe('applyPermitDefaults', () => {
  it('injects default validator (contract + creation timestamp) when no validator options given', () => {
    const before = Math.round(Date.now() / 1000);
    const result = permits.applyPermitDefaults(opts({  }), permitConfig, CHAIN);
    expect(result.validatorContract).toBe(VALIDATOR);
    expect(result.validatorId).toBeGreaterThanOrEqual(before - 60); // 60s clock-skew backdating
    expect(result.validatorId).toBeLessThanOrEqual(Math.round(Date.now() / 1000) - 59);
  });

  it('does not override an explicit validator pair', () => {
    const result = permits.applyPermitDefaults(
      { validatorId: 42, validatorContract: CONTRACT_A },
      permitConfig,
      CHAIN
    );
    expect(result.validatorId).toBe(42);
    expect(result.validatorContract).toBe(CONTRACT_A);
  });

  it('injects default contract scopes when no scope options given', () => {
    const result = permits.applyPermitDefaults(opts({  }), permitConfig, CHAIN);
    expect(result.contracts).toEqual([CONTRACT_A]);
  });

  it('does not inject scopes when the caller provides any scope option (incl. global)', () => {
    expect(permits.applyPermitDefaults(opts({ global: true }), permitConfig, CHAIN).contracts).toBeUndefined();
    expect(permits.applyPermitDefaults(opts({ handles: [1n] }), permitConfig, CHAIN).contracts).toBeUndefined();
    expect(permits.applyPermitDefaults(opts({ contracts: [] }), permitConfig, CHAIN).contracts).toEqual([]);
  });

  it('no-op for chains without defaults and for missing config', () => {
    expect(permits.applyPermitDefaults(opts({  }), permitConfig, 999)).toEqual({  });
    expect(permits.applyPermitDefaults(opts({  }), undefined, CHAIN)).toEqual({  });
  });
});
