import { describe, it, expect } from 'vitest';
import { resolveChainFilter, getMatrixChains } from '../src/matrix.js';

// ── Fixtures ──────────────────────────────────────────────────────────────────

const hardhat = { label: 'Hardhat (Mock)' };
const localcofhe = { label: 'Local CoFHE', optIn: true };
const sepolia = { label: 'Ethereum Sepolia' };
const arbSepolia = { label: 'Arbitrum Sepolia' };
const baseSepolia = { label: 'Base Sepolia' };
const brokenChain = { label: 'Broken Chain', disabled: true as const };

const ALL_CHAINS = [hardhat, localcofhe, sepolia, arbSepolia, baseSepolia];
const ALL_CHAINS_WITH_DISABLED = [...ALL_CHAINS, brokenChain];

// Helper: extract just the chainEnabled flags for readability.
function enabledMap<T extends { label: string }>(
  results: { chain: T; chainEnabled: boolean }[]
): Record<string, boolean> {
  return Object.fromEntries(results.map((r) => [r.chain.label, r.chainEnabled]));
}

// ── resolveChainFilter ────────────────────────────────────────────────────────

describe('resolveChainFilter', () => {
  it('returns null for empty/undefined input', () => {
    expect(resolveChainFilter()).toBeNull();
    expect(resolveChainFilter('')).toBeNull();
    expect(resolveChainFilter('   ')).toBeNull();
  });

  it('resolves a single slug to a label', () => {
    expect(resolveChainFilter('hardhat')).toEqual(['Hardhat (Mock)']);
    expect(resolveChainFilter('sepolia')).toEqual(['Ethereum Sepolia']);
    expect(resolveChainFilter('localcofhe')).toEqual(['Local CoFHE']);
  });

  it('resolves chain IDs to labels', () => {
    expect(resolveChainFilter('31337')).toEqual(['Hardhat (Mock)']);
    expect(resolveChainFilter('421614')).toEqual(['Arbitrum Sepolia']);
    expect(resolveChainFilter('420105')).toEqual(['Local CoFHE']);
  });

  it('resolves alternate spellings', () => {
    expect(resolveChainFilter('arbitrum-sepolia')).toEqual(['Arbitrum Sepolia']);
  });

  it('resolves comma-separated slugs to multiple labels', () => {
    expect(resolveChainFilter('hardhat,arb-sepolia')).toEqual(['Hardhat (Mock)', 'Arbitrum Sepolia']);
  });

  it('handles whitespace around commas', () => {
    expect(resolveChainFilter(' hardhat , sepolia ')).toEqual(['Hardhat (Mock)', 'Ethereum Sepolia']);
  });

  it('expands the testnet group alias', () => {
    expect(resolveChainFilter('testnet')).toEqual(['Ethereum Sepolia', 'Arbitrum Sepolia', 'Base Sepolia']);
  });

  it('expands the all group alias (includes localcofhe)', () => {
    const result = resolveChainFilter('all');
    expect(result).toContain('Local CoFHE');
    expect(result).toContain('Hardhat (Mock)');
    expect(result).toContain('Ethereum Sepolia');
    expect(result).toContain('Arbitrum Sepolia');
    expect(result).toContain('Base Sepolia');
  });

  it('throws on an unknown slug', () => {
    expect(() => resolveChainFilter('fakechain')).toThrow(/Unknown MATRIX_CHAIN/);
  });

  it('throws when one slug in a comma list is unknown', () => {
    expect(() => resolveChainFilter('hardhat,fakechain')).toThrow(/Unknown MATRIX_CHAIN/);
  });
});

// ── getMatrixChains ───────────────────────────────────────────────────────────

describe('getMatrixChains', () => {
  describe('no filter (MATRIX_CHAIN empty)', () => {
    it('enables non-opt-in chains', () => {
      const result = enabledMap(getMatrixChains('', '', ALL_CHAINS));
      expect(result['Hardhat (Mock)']).toBe(true);
      expect(result['Ethereum Sepolia']).toBe(true);
      expect(result['Arbitrum Sepolia']).toBe(true);
      expect(result['Base Sepolia']).toBe(true);
    });

    it('excludes opt-in chains by default', () => {
      const result = enabledMap(getMatrixChains('', '', ALL_CHAINS));
      expect(result['Local CoFHE']).toBe(false);
    });

    it('always excludes disabled chains', () => {
      const result = enabledMap(getMatrixChains('', '', ALL_CHAINS_WITH_DISABLED));
      expect(result['Broken Chain']).toBe(false);
    });
  });

  describe('with MATRIX_CHAIN filter', () => {
    it('enables only the matched chain', () => {
      const result = enabledMap(getMatrixChains('', 'hardhat', ALL_CHAINS));
      expect(result['Hardhat (Mock)']).toBe(true);
      expect(result['Ethereum Sepolia']).toBe(false);
    });

    it('includes opt-in chains when explicitly named', () => {
      const result = enabledMap(getMatrixChains('', 'localcofhe', ALL_CHAINS));
      expect(result['Local CoFHE']).toBe(true);
      expect(result['Hardhat (Mock)']).toBe(false);
    });

    it('MATRIX_CHAIN=all includes all chains including opt-in', () => {
      const result = enabledMap(getMatrixChains('', 'all', ALL_CHAINS));
      expect(result['Local CoFHE']).toBe(true);
      expect(result['Hardhat (Mock)']).toBe(true);
      expect(result['Arbitrum Sepolia']).toBe(true);
    });

    it('MATRIX_CHAIN=testnet enables only testnets', () => {
      const result = enabledMap(getMatrixChains('', 'testnet', ALL_CHAINS));
      expect(result['Ethereum Sepolia']).toBe(true);
      expect(result['Arbitrum Sepolia']).toBe(true);
      expect(result['Base Sepolia']).toBe(true);
      expect(result['Hardhat (Mock)']).toBe(false);
      expect(result['Local CoFHE']).toBe(false);
    });

    it('still excludes disabled chains even when filter matches label', () => {
      const chain = { label: 'Broken Chain', disabled: true as const };
      const chains = [chain];
      // CHAIN_SLUGS has no entry for 'Broken Chain' so we pass label directly
      // via a different chain that IS enabled — just verify disabled overrides filter
      const hardhatDisabled = { label: 'Hardhat (Mock)', disabled: true as const };
      const result = getMatrixChains('', 'hardhat', [hardhatDisabled]);
      expect(result[0].chainEnabled).toBe(false);
    });
  });

  describe('MATRIX_ENV filtering', () => {
    it('MATRIX_ENV empty enables both node and web', () => {
      const [r] = getMatrixChains('', '', [hardhat]);
      expect(r.nodeEnabled).toBe(true);
      expect(r.webEnabled).toBe(true);
    });

    it('MATRIX_ENV=node enables node only', () => {
      const [r] = getMatrixChains('node', '', [hardhat]);
      expect(r.nodeEnabled).toBe(true);
      expect(r.webEnabled).toBe(false);
    });

    it('MATRIX_ENV=web enables web only', () => {
      const [r] = getMatrixChains('web', '', [hardhat]);
      expect(r.nodeEnabled).toBe(false);
      expect(r.webEnabled).toBe(true);
    });

    it('MATRIX_ENV=all enables both', () => {
      const [r] = getMatrixChains('all', '', [hardhat]);
      expect(r.nodeEnabled).toBe(true);
      expect(r.webEnabled).toBe(true);
    });

    it('env filter applies per-chain when chain filter is set', () => {
      const result = getMatrixChains('node', 'hardhat', ALL_CHAINS);
      const hh = result.find((r) => r.chain.label === 'Hardhat (Mock)')!;
      const sep = result.find((r) => r.chain.label === 'Ethereum Sepolia')!;
      expect(hh.nodeEnabled).toBe(true);
      expect(hh.webEnabled).toBe(false);
      expect(sep.nodeEnabled).toBe(false);
      expect(sep.webEnabled).toBe(false);
    });
  });
});
